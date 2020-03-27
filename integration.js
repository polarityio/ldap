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
let clientCreationErrorCount = 0;

async function _createClient(options) {
  try {
    if (clientCreationErrorCount > 0) {
      Logger.error('Creating a client in the connection pool failed.');
      await sleep(30000);
    }

    let clientOptions = {
      url: options.url,
      connectTimeout: 5000,
      timeout: 5000
    };

    if(options.url.startsWith('ldaps')){
      clientOptions.tlsOptions = {};
      clientOptions.tlsOptions.rejectUnauthorized = config.request.rejectUnauthorized
    }

    Logger.debug(
      { clientOptions },
      options.disableConnectionPooling
        ? 'Creating new client'
        : 'Adding new client to connection pool'
    );

    let client = new Client(clientOptions);
    await client.bind(options.bindDN, options.password);

    Logger.debug(
      options.disableConnectionPooling
        ? 'New client is bound and ready for use'
        : 'New client is bound and available in pool'
    );

    return client;
  } catch (ex) {
    clientCreationErrorCount++;
    Logger.error({ ex }, '_createClient exception thrown');
    throw ex;
  }
}

/**
 * RFC 2254 Escaping of filter strings
 * Raw                     Escaped
 * (o=Parens (R Us))       (o=Parens \28R Us\29)
 * (cn=star*)              (cn=star\2A)
 * (filename=C:\MyFile)    (filename=C:\5cMyFile)
 *
 * @param {string|Buffer} input
 */
function _escapeFilter(input) {
  let escapedResult = '';
  if (Buffer.isBuffer(input)) {
    for (const inputChar of input) {
      if (inputChar < 16) {
        escapedResult += `\\0${inputChar.toString(16)}`;
      } else {
        escapedResult += `\\${inputChar.toString(16)}`;
      }
    }
  } else {
    for (const inputChar of input) {
      switch (inputChar) {
        case '*':
          escapedResult += '\\2a';
          break;
        case '(':
          escapedResult += '\\28';
          break;
        case ')':
          escapedResult += '\\29';
          break;
        case '\\':
          escapedResult += '\\5c';
          break;
        case '\0':
          escapedResult += '\\00';
          break;
        default:
          escapedResult += inputChar;
          break;
      }
    }
  }

  return escapedResult;
}

function _getClientFactory(options) {
  let clientFactory = {
    create: function() {
      return _createClient(options);
    },
    destroy: function(client) {
      Logger.debug({ isConnected: client.isConnected }, 'Destroying client');
      return client.unbind();
    },
    validate: function(client) {
      Logger.debug(
        {
          isConnected: client.isConnected
        },
        'Validating client'
      );
      return Promise.resolve(client.isConnected);
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
      Logger.info('Attempting to drain pool');
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

function _logFactoryCreateError(err) {
  _logPoolStats('error', 'LDAP Connection Pool factoryCreateError occurred');
  Logger.error(err);
}

function _createPool(options, cbOnce, shutDownIntegrationOnce) {
  let localPool;

  let logFactoryCreateErrorOnce = once(_logFactoryCreateError);

  const opts = {
    // maximum size of the pool.  If connection pooling is disabled, then we set the max connection pool size to 1
    // which effectively disables connection pooling.
    max: options.maxClients,
    min: Math.floor(options.maxClients / 4), // minimum size of the pool,
    // maxWaitingClients must be at least 1 for the single client request that will be serviced.
    maxWaitingClients: options.maxClients * 10,
    acquireTimeoutMillis: 7000,
    testOnBorrow: true
  };

  Logger.info({ poolOptions: opts }, 'Generating New Connection Pool');

  localPool = genericPool.createPool(_getClientFactory(options), opts);

  localPool.on('factoryCreateError', function(err) {
    logFactoryCreateErrorOnce(err);
    cbOnce({
      detail: err.message,
      stack: err.stack,
      name: err.name,
      err: err
    });

    shutDownIntegrationOnce();
  });

  localPool.on('factoryDestroyError', function(err) {
    _logPoolStats(
      'error',
      'LDAP Connection Pool: factoryDestroyError occurred'
    );
    Logger.error(err);
  });

  return localPool;
}

function _logPoolStats(level, msg) {
  Logger[level](
    {
      poolSize: pool.size,
      poolAvailable: pool.available,
      poolBorrowed: pool.borrowed,
      poolPending: pool.pending,
      poolMax: pool.max,
      poolMin: pool.min
    },
    msg
  );
}

function _shutDownIntegration() {
  Logger.info('Starting shutdown of integration');
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

  // Do a one time connection pool creation as long as connection pooling is not disabled.
  if (pool === null && options.disableConnectionPooling === false) {
    let shutdownIntegrationOnce = once(_shutDownIntegration);
    pool = _createPool(options, cbOnce, shutdownIntegrationOnce);
  }

  async.eachLimit(
    entities,
    options.maxClients,
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
      Logger.trace({ lookupResults }, 'Lookup Results');
      Logger.debug(
        { numLookupResults: lookupResults.length },
        'Lookup Results Length'
      );
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

function _getFilter(entityObj, options) {
  let filter = '';
  if (options.userSearchAttribute.length > 0) {
    filter = `(${options.userSearchAttribute}=${_escapeFilter(
      entityObj.value
    )})`;
  } else {
    filter = options.searchFilter.replace(
      /{{entity}}/g,
      _escapeFilter(entityObj.value)
    );
  }
  return filter;
}

/**
 * Helper method which returns a new client.  If connection pooling is disabled the client is created
 * and returned directly.  If connection pooling is enabled the client is fetched from the connection pool.
 * @param options
 * @returns {Promise<undefined|*>}
 * @private
 */
async function _getClient(options) {
  if (options.disableConnectionPooling) {
    return await _createClient(options);
  } else {
    return await pool.acquire();
  }
}

/**
 * Helper method which releases a client back to the pool if connection pooling is enabled.  If connection pooling
 * is disabled, the client is unbound to close the connection.
 * @param client
 * @param options
 * @returns {Promise<any>}
 * @private
 */
async function _releaseClient(client, options) {
  if (options.disableConnectionPooling) {
    return await client.unbind();
  } else {
    return await pool.release(client);
  }
}

/**
 * Helper method which destroys the client out of the pool if connection pooling is enabled.  Otherwise, we attempt
 * to unbind the client if it exists.
 * @param client
 * @param options
 * @returns {Promise<void|*>}
 * @private
 */
async function _destroyClient(client, options) {
  if (client) {
    if (options.disableConnectionPooling) {
      return await client.unbind();
    } else {
      return pool.destroy(client);
    }
  }
}

async function _findUser(entityObj, options) {
  let client;
  try {
    client = await _getClient(options);

    Logger.trace({ socket: client.socket }, 'Socket');
    Logger.debug(
      { connected: client.isConnected, entity: entityObj.value },
      'Running LDAP search'
    );

    const { searchEntries } = await client.search(options.searchDN, {
      scope: 'sub', //possible values are `base`, `one`, or `sub` https://ldapwiki.com/wiki/LDAP%20Search%20Scopes
      filter: _getFilter(entityObj, options),
      sizeLimit: 1
    });

    await _releaseClient(client, options);

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
      userOptions: {
        summaryUserAttributes: options.summaryUserAttributes,
        summaryCustomUserAttributes: options.summaryCustomUserAttributes,
        detailedUserAttributes: options.detailedUserAttributes,
        detailedCustomUserAttributes: options.detailedCustomUserAttributes
      },
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
    // We had an error so there is probably something wrong with this client.
    Logger.error(client, 'Client with error');
    _destroyClient(client);
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
  } else if (Array.isArray(value)) {
    return { value, type: 'array' };
  } else {
    return { value, type: 'string' };
  }
}

module.exports = {
  doLookup: doLookup,
  startup: startup
};
