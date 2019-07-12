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
    // Relative paths are relative to the VT integration's root directory
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    // Relative paths are relative to the VT integration's root directory
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    // Relative paths are relative to the VT integration's root directory
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    // Relative paths are relative to the VT integration's root directory
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: '',
    /**
     * If set to false, the integration will ignore SSL errors.  This will allow the integration to connect
     * to the ARIN servers without valid SSL certificates.  Please note that we do NOT recommending setting this
     * to false in a production environment.
     */
    rejectUnauthorized: true
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
      name:
        'Maximum Connection Pool Size (Changes Require Integration Restart)',
      description:
        'The maximum number of pooled LDAP connections that will be maintained by the integration. If all pooled connections are in use new lookup requests will be queued (if too many requests are queued the integration will drop the request and report an error). After changing this option you must restart the integration for the changes to take place.  This option must be set to "Only admins can view and edit". This setting must be configured as an admin-only setting.',
      default: 10,
      type: 'number',
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
    }
  ]
};
