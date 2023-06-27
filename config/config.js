module.exports = {
  /**
   * Name of the integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @required
   */
  name: 'LDAP',
  /**
   * The acronym that appears in the notification window when information from this integration
   * is displayed.  Note that the acronym is included as part of each "tag" in the summary information
   * for the integration.  As a result, it is best to keep it to 4 or less characters.  The casing used
   * here will be carried forward into the notification window.
   *
   * @type String
   * @required
   */
  acronym: 'LDAP',

  logging: {
    level: 'info'
  }, //trace, debug, info, warn, error, fatal
  /**
   * Description for this integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @optional
   */
  description:
    'Search your Lightweight Directory Access Protocol (LDAP) server by email address',
  entityTypes: ['email'],
  defaultColor: 'light-blue',
  /**
   * An array of style files (css or less) that will be included for your integration. Any styles specified in
   * the below files can be used in your custom template.
   *
   * @type Array
   * @optional
   */
  styles: ['./styles/ldap.less'],
  /**
   * Provide custom component logic and template for rendering the integration details block.  If you do not
   * provide a custom template and/or component then the integration will display data as a table of key value
   * pairs.
   *
   * @type Object
   * @optional
   */
  block: {
    component: {
      file: './components/ldap-block.js'
    },
    template: {
      file: './templates/ldap-block.hbs'
    }
  },
  summary: {
    component: {
      file: './components/ldap-summary.js'
    },
    template: {
      file: './templates/ldap-summary.hbs'
    }
  },
  request: {
    // Provide the path to your certFile. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: ""
  },
  /**
   * Options that are displayed to the user/admin in the Polarity integration user-interface.  Should be structured
   * as an array of option objects.
   *
   * @type Array
   * @optional
   */
  options: [
    {
      key: 'url',
      name: 'LDAP Server URL (Change Requires Integration Restart)',
      description:
        "URL for your LDAP server. (e.g., 'ldap://dc.domain.com' or 'ldaps://dc.domain.com'). If you make a change to this option you will need to restart the integration for the change to take effect. This setting must be configured as an admin-only setting.",
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'bindDN',
      name: 'Bind Distinguished Name (Change Requires Integration Restart)',
      description:
        "LDAP Bind DN (e.g., 'uid=tony.stark,ou=Users,o=5be4c382c583e54de6a3ff52,dc=jumpcloud,dc=com'). If you make a change to this option you will need to restart the integration for the change to take effect. This setting must be configured as an admin-only setting.",
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'password',
      name: 'Password (Change Requires Integration Restart)',
      description:
        'Bind DN Password. If you make a change to this option you will need to restart the integration for the change to take effect. This setting must be configured as an admin-only setting.',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'maxClients',
      name: 'Maximum Concurrent Search Requests (Changes Require Integration Restart)',
      description:
        'The maximum number of concurrent search requests that can run at a time.  When using connection pooling, this value is the total number of pooled connections.  If all pooled connections are in use, new lookup requests will be queued (if too many requests are queued the integration will drop the request and report an error). After changing this option you must restart the integration for the changes to take place.  This option must be set to "Only admins can view and edit". This setting must be configured as an admin-only setting.',
      default: 10,
      type: 'number',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'disableConnectionPooling',
      name: 'Disable Connection Pooling (Change Requires Integration Restart)',
      description:
        'If checked, the integration will not use connection pooling.  When connection pooling is disabled, each search request to the LDAP server will bind and unbind a new connection.  If you disable connection pooling, this integration should be set to On-Demand Only. This option must be set to "Only admins can view and edit". This setting must be configured as an admin-only setting.',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchDN',
      name: 'Search DN',
      description:
        "The distinguished name from where searches will start.  The integration will search the whole sub tree under the provided distinguished name (e.g., 'ou=Users,o=5be4c382c583e54de6a3ff52,dc=jumpcloud,dc=com').",
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'userSearchAttribute',
      name: 'User Email Search Attribute',
      description:
        'The search attribute for user objects (case sensitive).  This attribute should be an email address and will be compared against the email address being looked up.  Typical values are `userPrincipalName`, `distinguishedName`, `sAMAccountName`, or `mail`.  If this option is left blank, the `Advanced Search Filter` below will be used.',
      default: 'userPrincipalName',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchFilter',
      name: 'Advanced Search Filter (Optional)',
      description:
        'The search filter used to identify the user object to be displayed by the integration.  If left blank, a strict equality check will be done against the attribute specified by the `User Email Search Attribute`. An example search filter to search two different attributes would be (|(mail={{entity}})(sAMAccountName={{entity}})).  Note that `{{entity}}` will be replaced with the value of the entity being looked up.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'summaryUserAttributes',
      name: 'Summary User Attributes',
      description:
        'Select user attributes you would like to display in the summary portion of the integration as tags.',
      default: [
        {
          value: 'displayName',
          display: 'Display Name'
        }
      ],
      type: 'select',
      options: [
        {
          value: 'cn',
          display: 'CN'
        },
        {
          value: 'comment',
          display: 'Comment'
        },
        {
          value: 'description',
          display: 'Description'
        },
        {
          value: 'distinguishedName',
          display: 'Distinguished Name'
        },
        {
          value: 'displayName',
          display: 'Display Name'
        },
        {
          value: 'employeeID',
          display: 'Employee Id'
        },
        {
          value: 'givenName',
          display: 'Given Name'
        },
        {
          value: 'initials',
          display: 'Initials'
        },
        {
          value: 'lockoutTime',
          display: 'Lockout Time'
        },
        {
          value: 'mail',
          display: 'Mail'
        },
        {
          value: 'memberOf',
          display: 'Member Of'
        },
        {
          value: 'pwdLastSet',
          display: 'Pwd Last Set'
        },
        {
          value: 'sAMAccountName',
          display: 'SAM Account Name'
        },
        {
          value: 'sn',
          display: 'SN'
        },
        {
          value: 'userAccountControl',
          display: 'User Account Control'
        },
        {
          value: 'userPrincipalName',
          display: 'User Principal Name'
        },
        {
          value: 'whenCreated',
          display: 'When Created'
        }
      ],
      multiple: true,
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'summaryCustomUserAttributes',
      name: 'Custom Summary User Attributes',
      description:
        'Custom user attributes you would like to display in the summary portion of the integration as tags.  Provide a comma delimited list. Attributes are case sensitive.',
      default: '',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'detailedUserAttributes',
      name: 'Detailed User Attributes',
      description:
        'Select user attributes you would like to display in the details portion of the integration',
      default: [
        {
          value: 'displayName',
          display: 'Display Name'
        },
        {
          value: 'distinguishedName',
          display: 'Distinguished Name'
        },
        {
          value: 'userAccountControl',
          display: 'User Account Control'
        },
        {
          value: 'memberOf',
          display: 'Member Of'
        }
      ],
      type: 'select',
      options: [
        {
          value: 'cn',
          display: 'CN'
        },
        {
          value: 'comment',
          display: 'Comment'
        },
        {
          value: 'description',
          display: 'Description'
        },
        {
          value: 'distinguishedName',
          display: 'Distinguished Name'
        },
        {
          value: 'displayName',
          display: 'Display Name'
        },
        {
          value: 'employeeID',
          display: 'Employee Id'
        },
        {
          value: 'givenName',
          display: 'Given Name'
        },
        {
          value: 'initials',
          display: 'Initials'
        },
        {
          value: 'lockoutTime',
          display: 'Lockout Time'
        },
        {
          value: 'mail',
          display: 'Mail'
        },
        {
          value: 'memberOf',
          display: 'Member Of'
        },
        {
          value: 'pwdLastSet',
          display: 'Pwd Last Set'
        },
        {
          value: 'sAMAccountName',
          display: 'SAM Account Name'
        },
        {
          value: 'sn',
          display: 'SN'
        },
        {
          value: 'userAccountControl',
          display: 'User Account Control'
        },
        {
          value: 'userPrincipalName',
          display: 'User Principal Name'
        },
        {
          value: 'whenCreated',
          display: 'When Created'
        }
      ],
      multiple: true,
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'detailedCustomUserAttributes',
      name: 'Custom Detailed User Attributes',
      description:
        'Custom user attributes you would like to display in the details portion of the integration.  Provide a comma delimited list. Attributes are case sensitive.',
      default: '',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'attributeDisplayMappings',
      name: 'Attribute Display Name Mappings',
      description:
        'A comma delimited list of attribute display name mappings which let you change the display name of an attribute in the integration.  This can be used to provide human-readable ' +
        'attributes.  Each mapping should be the original attribute name followed by a colon and then the desired display name.  For example, if the attribute is "flm" and you want that to display as "front line manager", ' +
        'you would enter "flm:Front line manager".  Attribute names are case-sensitive.',
      default: 'cn:Common name,dc:Domain component',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'simplifiedGroupNames',
      name: 'Display Simplified Group Names',
      description:
        'If checked, group names will only show the leaf entry of the fully qualified group name.  For example, if the full group name is "CN=PolarityUsers,CN=Users,DC=polarity,DC=io", when this option is checked ' +
        'the group name would be displayed as "PolarityUsers".  Group names are only shown if your LDAP implementation includes a "memberOf" attribute.',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'usernameAttribute',
      name: 'Username Attribute',
      description:
        'The case-sensitive LDAP attribute which represents the account\'s username or full name.  This value is used to display group membership.  (defaults to "sAMAccountName").  Group membership is only shown if your LDAP implementation includes a "memberof" attribute.',
      default: 'sAMAccountName',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'mailAttribute',
      name: 'Mail Attribute',
      description:
        'The case-sensitive LDAP attribute which contains the account\'s email address.  This value is used to display group membership.  (defaults to "mail").  Group membership is only shown if your LDAP implementation includes a "memberof" attribute.',
      default: 'mail',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};
