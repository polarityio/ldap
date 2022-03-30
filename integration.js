'use strict';

const async = require('async');
const { Client } = require('ldapts');
const moment = require('moment');
const config = require('./config/config');
const genericPool = require('generic-pool');
const once = require('lodash.once');
const { userAccountControlToStrings } = require('./lib/user-account-control');
const { simpleGroupName } = require('./lib/member-of');
const sleep = require('util').promisify(setTimeout);

const MAX_USERS_TO_RETURN_IN_GROUP = 25;
const generalizedTimeRegex = /\d{14}\.0Z/;
const integer8Regex = /\d{18}/;

// contains the list of valid group search attributes
let Logger = null;
let pool = null;
let clientCreationErrorCount = 0;
let previousAttributeDisplayMappingsString = null;
let attributeDisplayNameMappings = {};

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
    create: function () {
      return _createClient(options);
    },
    destroy: function (client) {
      Logger.debug({ isConnected: client.isConnected }, 'Destroying client');
      return client.unbind();
    },
    validate: function (client) {
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

  localPool.on('factoryCreateError', function (err) {
    logFactoryCreateErrorOnce(err);
    cbOnce({
      detail: err.message,
      stack: err.stack,
      name: err.name,
      err: err
    });

    shutDownIntegrationOnce();
  });

  localPool.on('factoryDestroyError', function (err) {
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

  if (
    previousAttributeDisplayMappingsString === null ||
    previousAttributeDisplayMappingsString !== options.attributeDisplayMappings
  ) {
    // attributeDisplayNameMappings is an object which is keyed on the attribute and provides the display name
    // for that attribute
    attributeDisplayNameMappings = options.attributeDisplayMappings
      .split(',')
      .reduce((acc, token) => {
        // token is of the form `attribute:displayName` (e.g., `cn:Common Name`)
        const parts = token.trim().split(':');
        const attribute = parts[0].trim();
        const displayName = parts[1].trim();
        acc[attribute] = displayName;
        return acc;
      }, {});
    previousAttributeDisplayMappingsString = options.attributeDisplayMappings;
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

    Logger.trace({ user }, 'LDAP User Lookup result');

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
      userDetailsList: _processUserResult(user, detailAttributes, options)
        .userAttributeList,
      userSummaryHash: _processUserResult(user, summaryAttributes, options)
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
    await _destroyClient(client, options);
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
        accum.push({
          value: value,
          // if we have a custom display name mapping use it
          display: attributeDisplayNameMappings[value]
            ? attributeDisplayNameMappings[value]
            : null
        });
      }
      return accum;
    }, []);

  const processedAttributes = attributes.map((attribute) => {
    return {
      value: attribute.value,
      display: attributeDisplayNameMappings[attribute.value]
        ? attributeDisplayNameMappings[attribute.value]
        : attribute.display
    };
  });

  return processedAttributes.concat(customAttributes);
}

/**
 * Converts the user object into an array of user attributes which is easier for our template to render
 * @param user
 * @param options
 * @param userAttributes
 * @returns {Object}
 * @private
 */
function _processUserResult(user, userAttributes, options) {
  const userAttributeList = [];
  const userAttributeHash = {};
  let memberOfAttribute = null;
  let userAccountControlAttribute = null;

  userAttributes.forEach((attr) => {
    const attributeName = attr.value;
    const attributeValue = user[attributeName];
    if (attributeValue) {
      const parsedValue = parseAttributeValue(
        attributeName,
        attributeValue,
        options
      );

      const attributeObject = {
        value: parsedValue.value,
        originalValue: parsedValue.originalValue,
        name: attributeName,
        display: attr.display,
        type: parsedValue.type
      };

      if(attributeName === 'memberOf'){
        memberOfAttribute = attributeObject;
      } else if(attributeName === 'userAccountControl'){
        userAccountControlAttribute = attributeObject;
      } else {
        userAttributeList.push(attributeObject);
      }
      userAttributeHash[attributeName] = attributeObject;
    }
  });

  // This is a simplistic way to ensure that the userAccountControl and memberOf attributes always come last
  // when rendering the template as we render in array order.
  if(userAccountControlAttribute){
    userAttributeList.push(userAccountControlAttribute);
  }
  if(memberOfAttribute){
    userAttributeList.push(memberOfAttribute);
  }
  return { userAttributeList, userAttributeHash };
}

/**
 * Parses returned AD values to convert any dates in ISO 8601.
 * @param value
 * @returns {*}
 */
function parseAttributeValue(attributeName, value, options) {
  if (attributeName === 'userAccountControl') {
    return {
      originalValue: value,
      value: userAccountControlToStrings(parseInt(value, 10)),
      type: 'tag'
    };
  }

  if (
    attributeName === 'memberOf' &&
    options.simplifiedGroupNames &&
    Array.isArray(value)
  ) {
    return {
      originalValue: value,
      value: value.map((group) => simpleGroupName(group)),
      type: 'array'
    };
  }

  if (generalizedTimeRegex.test(value)) {
    return {
      originalValue: value,
      value: moment(value, 'YYYYMMDDHHmmss.Z').toISOString(),
      type: 'date'
    };
  } else if (integer8Regex.test(value)) {
    return {
      originalValue: value,
      value: moment(value / 1e4 - 1.16444736e13).toISOString(),
      type: 'date'
    };
  } else if (Array.isArray(value)) {
    return { value, originalValue: value, type: 'array' };
  } else {
    return { value, originalValue: value, type: 'string' };
  }
}

async function onMessage(payload, options, cb) {
  const group = payload.group;
  let client;
  try {
    let cbOnce = once(cb);

    // Do a one time connection pool creation as long as connection pooling is not disabled.
    if (pool === null && options.disableConnectionPooling === false) {
      let shutdownIntegrationOnce = once(_shutDownIntegration);
      pool = _createPool(options, cbOnce, shutdownIntegrationOnce);
    }

    client = await _getClient(options);

    Logger.trace({ socket: client.socket }, 'Socket');
    Logger.debug(
      { connected: client.isConnected, group },
      'Running LDAP Group search'
    );

    const { searchEntries } = await client.search(options.searchDN, {
      scope: 'sub', //possible values are `base`, `one`, or `sub` https://ldapwiki.com/wiki/LDAP%20Search%20Scopes
      filter: `(&(objectCategory=user)(memberOf=${group}))`,
      sizeLimit: MAX_USERS_TO_RETURN_IN_GROUP
    });

    const users = searchEntries.map(user => {
      return {
        name: user[options.usernameAttribute],
        mail: user[options.mailAttribute]
      }
    });

    await _releaseClient(client, options);
    cb(null, {
      users
    });
  } catch (error) {
    // We had an error so there is probably something wrong with this client.
    Logger.error(error, 'Client with error');
    await _destroyClient(client, options);
    cb(error);
  }
}

function validateOptions(options, cb){
  let errors = [];

  const url = options.url.value;

  // Either userSearchAttribute or searchFilter must be set
  const userSearchAttribute = options.userSearchAttribute.value;
  const searchFilter = options.searchFilter.value;

  if (typeof url === 'string' && url.length === 0) {
    errors.push({
      key: 'url',
      message: 'You must provide a URL for your LDAP server.'
    });
  }

  if (typeof url === 'string' && !url.startsWith('ldap://') && !url.startsWith('ldaps://')) {
    errors.push({
      key: 'url',
      message: 'The provided url must begin with "ldap://" or "ldaps://".'
    });
  }

  if(typeof userSearchAttribute === 'string' && userSearchAttribute.length === 0 &&
  typeof searchFilter === 'string' && searchFilter.length === 0){
    errors.push({
      key: 'userSearchAttribute',
      message: 'You must provide either a "User Search Email Attribute" or an "Advanced Search Filter"'
    });
    errors.push({
      key: 'searchFilter',
      message: 'You must provide either a "User Search Email Attribute" or an "Advanced Search Filter"'
    });
  }

  cb(null, errors);
}

module.exports = {
  doLookup,
  startup,
  onMessage,
  validateOptions
};
