'use strict';

const async = require('async');
const { Client } = require('ldapts');
const moment = require('moment');
const config = require('./config/config');
const genericPool = require('generic-pool');
const once = require('lodash.once');
const sleep = require('util').promisify(setTimeout);

const generalizedTimeRegex = /\d{14}\.0Z/;
const integer8Regex = /\d{18}/;

// contains the list of valid group search attributes
let Logger = null;
let pool = null;
let previousMaxClients = 0;
let clientCreationErrorCount = 0;

async function _createClient(options) {
  try {
    if (clientCreationErrorCount > 0) {
      Logger.error('Creating a client in the connection pool failed.  Preventing ');
      await sleep(30000);
    }

    let clientOptions = {
      url: options.url,
      tlsOptions: {
        rejectUnauthorized: config.request.rejectUnauthorized
      },
      connectTimeout: 5000,
      timeout: 5000
    };

    Logger.debug(clientOptions, 'Adding new client to connection pool');
    let client = new Client(clientOptions);

    await client.bind(options.bindDN, options.password);
    Logger.debug('New client is bound and available in pool');
    return client;
  } catch (ex) {
    clientCreationErrorCount++;
    throw ex;
  }
}

function _getClientFactory(options) {
  let clientFactory = {
    create: function() {
      return _createClient(options);
    },
    destroy: async function(client) {
      return await client.unbind();
    }
  };

  return clientFactory;
}

function startup(logger) {
  Logger = logger;
}

function _disconnectPool() {
  return new Promise((resolve, reject) => {
    if (pool) {
      Logger.info("Attempting to drain pool");
      pool.drain().then(() => {
        pool.clear();
        Logger.info('Connection pool is drained and cleared');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function _logConnectionError(err) {
  Logger.error('LDAP Connection Pool factoryCreateError occurred');
  Logger.error(err);
}

function _createPool(options, cbOnce, shutDownIntegrationOnce) {
  let localPool;

  let logConnectionErrorOnce = once(_logConnectionError);

  const opts = {
    max: options.maxClients, // maximum size of the pool
    min: Math.floor(options.maxClients / 4), // minimum size of the pool,
    maxWaitingClients: options.maxClients * 2,
    acquireTimeoutMillis: 5000
  };

  Logger.info({ poolOptions: opts }, 'Generating New Connection Pool');

  localPool = genericPool.createPool(_getClientFactory(options), opts);

  localPool.on('factoryCreateError', function(err) {
    logConnectionErrorOnce(err);
    cbOnce({
      detail: err.message,
      stack: err.stack,
      name: err.name,
      err: err
    });

    shutDownIntegrationOnce();
  });

  localPool.on('factoryDestroyError', function(err) {
    Logger.error('LDAP Connection Pool: factoryDestroyError occurred');
    Logger.error(err);
  });

  return localPool;
}

function _shutDownIntegration() {
  Logger.info("Starting shutdown of integration");
  _disconnectPool().finally(() => {
    setTimeout(() => {
      // Delay exiting the process by a second so logs can finish writing out
      Logger.info('Exiting Integration Process');
      process.exit();
    }, 250);
  });
}

function doLookup(entities, options, cb) {
  const lookupResults = [];
  let cbOnce = once(cb);
  let shutdownIntegrationOnce = once(_shutDownIntegration);

  if (pool === null) {
    pool = _createPool(options, cbOnce, shutdownIntegrationOnce);
  }

  async.each(
    entities,
    (entityObj, next) => {
      _findUser(entityObj, options)
        .then((result) => {
          lookupResults.push(result);
          next(null);
        })
        .catch((err) => {
          next(err);
        });
    },
    (err) => {
      Logger.debug({ lookupResults }, 'Lookup Results');
      if (err) {
        Logger.error('Error encountered while trying to execute _findUser');
        Logger.error(err);
        cbOnce({
          name: err.name,
          detail: err.message,
          stack: err.stack
        });
      } else {
        cbOnce(null, lookupResults);
      }
    }
  );
}

async function _findUser(entityObj, options) {
  let client;
  try {
    client = await pool.acquire();

    const { searchEntries } = await client.search(options.searchDN, {
      scope: 'sub', //possible values are `base`, `one`, or `sub` https://ldapwiki.com/wiki/LDAP%20Search%20Scopes
      filter: `(${options.userSearchAttribute}=${entityObj.value})`,
      sizeLimit: 1
    });

    pool.release(client);

    if (searchEntries.length === 0) {
      return {
        entity: entityObj,
        data: null
      };
    }

    let user = searchEntries[0];

    const summaryAttributes = getAttributes(
      options.summaryUserAttributes,
      options.summaryCustomUserAttributes
    );
    const detailAttributes = getAttributes(
      options.detailedUserAttributes,
      options.detailedCustomUserAttributes
    );

    const details = {
      userDetailsList: _processUserResult(user, detailAttributes)
        .userAttributeList,
      userSummaryHash: _processUserResult(user, summaryAttributes)
        .userAttributeHash
    };

    return {
      // Required: This is the entity object passed into the integration doLookup method
      entity: entityObj,
      // Required: An object containing everything you want passed to the template
      data: {
        // Required: These are the tags that are displayed in your template
        summary: [],
        // Data that you want to pass back to the notification window details block
        details: details
      }
    };
  } catch (ex) {
    if (client) {
      pool.destroy(client);
    }
    throw ex;
  }
}

/**
 * Return an array of attribute objects with `value` and `display` properties
 *
 * @param userAttributes {Array} an array of attributes objects with `value` and `display` properties
 * @param customAttributes {String} a comma delimited string of custom attributes
 */
function getAttributes(attributes, customAttributesString) {
  const customAttributes = customAttributesString
    .split(',')
    .reduce((accum, value) => {
      value = value.trim();
      if (value.length > 0) {
        accum.push({ value: value, display: value });
      }
      return accum;
    }, []);

  return attributes.concat(customAttributes);
}

/**
 * Converts the user object into an array of user attributes which is easier for our template to render
 * @param user
 * @param options
 * @returns {Object}
 * @private
 */
function _processUserResult(user, userAttributes) {
  const userAttributeList = [];
  const userAttributeHash = {};

  userAttributes.forEach((attr) => {
    if (user[attr.value]) {
      const parsedValue = parseAttributeValue(user[attr.value]);
      userAttributeList.push({
        value: parsedValue.value,
        display: attr.display,
        type: parsedValue.type
      });
      userAttributeHash[attr.value] = {
        value: parsedValue.value,
        display: attr.display,
        type: parsedValue.type
      };
    }
  });

  return { userAttributeList, userAttributeHash };
}

/**
 * Parses returned AD values to convert any dates in ISO 8601.
 * @param value
 * @returns {*}
 */
function parseAttributeValue(value) {
  if (generalizedTimeRegex.test(value)) {
    return {
      value: moment(value, 'YYYYMMDDHHmmss.Z').toISOString(),
      type: 'date'
    };
  } else if (integer8Regex.test(value)) {
    return {
      value: moment(value / 1e4 - 1.16444736e13).toISOString(),
      type: 'date'
    };
  } else {
    return { value, type: 'string' };
  }
}

function validateOptions(userOptions, cb) {
  Logger.trace('Options to validate', userOptions);
  Logger.trace('Options to validate', userOptions);

  let errors = [];

  validateOption(
    errors,
    userOptions,
    'host',
    'You must provide a valid ldap host.'
  );

  validateOption(
    errors,
    userOptions,
    'baseDN',
    'You must provide a baseDN used by your installation of Active Directory'
  );

  validateOption(
    errors,
    userOptions,
    'username',
    'You must provide a valid username'
  );

  validateOption(
    errors,
    userOptions,
    'password',
    'You must provide a valid password'
  );

  cb(null, errors);
}

function validateOption(errors, options, optionName, errMessage) {
  if (
    !options[optionName] ||
    typeof options[optionName].value !== 'string' ||
    (typeof options[optionName].value === 'string' &&
      options[optionName].value.length === 0)
  ) {
    errors.push({
      key: optionName,
      message: errMessage
    });
  }
}

module.exports = {
  doLookup: doLookup,
  startup: startup
  //validateOptions: validateOptions
};
