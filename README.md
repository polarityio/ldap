# Polarity LDAP Integration

> Important: We recommend testing this integration against a dev instance of your LDAP setup prior to connecting to a production LDAP system.  This is to ensure the queries do not overload your production LDAP server.


> The LDAP integration is a successor to the previous ActiveDirectory integration which has been deprecated.  New users should install the LDAP integration as it is more configurable and significantly more performant when querying your LDAP server due to the use of connection pooling.

The Polarity LDAP integration allows Polarity to search LDAP for user information.  

| ![image](https://user-images.githubusercontent.com/306319/45964318-7672e700-bff3-11e8-8a7c-6d80a5d5f53e.png) |
|---|
|*LDAP Example*|

## LDAP Integration Options

### LDAP Server URL

*Admin Only Setting*

URL for your LDAP server. This setting must be configured as an **admin-only setting** (i.e., each user cannot set their own value).

For example:

```
ldap://dc.domain.com
```
or
```
ldaps://dc.domain.com
```

### Bind Distinguished Name

*Admin Only Setting*

The Distinguised Name that the integration will attempt to bind as. This setting must be configured as an **admin-only setting** (i.e., each user cannot set their own value).

For example:

```
uid=tony.stark,ou=Users,o=5be4c382c583e54de6a3ff52,dc=jumpcloud,dc=com
```

### Password

*Admin Only Setting*

The LDAP Account Password for the provided `Bind Distinguished Name`. This setting must be configured as an **admin-only setting** (i.e., each user cannot set their own value).


### Search Distinguished Name

The distinguished name from where searches will start.  The integration will search the whole sub tree under the provided distinguished name.

```
ou=Users,o=5be4c382c583e54de6a3ff52,dc=jumpcloud,dc=com
```

### User Email Search Attribute

*Admin Only Setting*

The user attribute that will be used to compare against the email address being looked up (i.e., this attribute should be the user's email address). This attribute defaults to `userPrincipalName`. This setting must be configured as an **admin-only setting** (i.e., each user cannot set their own value).


### Custom User Email Search Attribute

*Admin Only Setting* 

A custom attribute to set that will be used to compare against the email address being looked up.  This option should be used if the email attribute in your LDAP system is not provided as an option in the above `User Email Search Attribute` dropdown list.  This option can be left blank.

### Summary User Attributes

One or more user attributes you would like to display in summary portion of the integration as tags.  If the attribute you would like to display is not listed, you can add a custom attribute using the `Custom Summary User Attributes` option.

### Custom Summary User Attributes

Custom user attributes you would like to display in the summary portion of the integration as tags.  Provide a comma delimited list. Attributes are case sensitive.  Attributes provided in this setting will be displayed along with attributes selected for the `Summary User Attributes`.

### Detailed User Attributes

One or more user attributes you would like to display in the details portion of the integration

### Custom Detailed User Attributes

Custom user attributes you would like to display in the details portion of the integration.  Provide a comma delimited list. Attributes are case sensitive.


## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see:

https://polarity.io/
