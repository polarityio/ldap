const USER_ACCOUNT_CONTROL_MAP = [
  'SCRIPT', //1
  'ACCOUNTDISABLE', //2
  'NA', //4
  'HOMEDIR_REQUIRED', //8
  'LOCKOUT', //16
  'PASSWD_NOTREQD', //32
  'PASSWD_CANT_CHANGE', //64
  'ENCRYPTED_TEXT_PWD_ALLOWED', //128
  'TEMP_DUPLICATE_ACCOUNT', //256
  'NORMAL_ACCOUNT', //512
  'NA', //1024
  'INTERDOMAIN_TRUST_ACCOUNT', //2048
  'WORKSTATION_TRUST_ACCOUNT', //4096
  'SERVER_TRUST_ACCOUNT', //8192
  'NA',  //16384
  'NA',  //32768
  'DONT_EXPIRE_PASSWORD',
  'MNS_LOGON_ACCOUNT',
  'SMARTCARD_REQUIRED',
  'TRUSTED_FOR_DELEGATION',
  'NOT_DELEGATED',
  'USE_DES_KEY_ONLY',
  'DONT_REQ_PREAUTH',
  'PASSWORD_EXPIRED',
  'TRUSTED_TO_AUTH_FOR_DELEGATION',
  'PARTIAL_SECRETS_ACCOUNT'
];

function dec2bin(dec) {
  return (dec >>> 0).toString(2);
}

/**
 * This method takes a base 10 integer and converts it into an array of userAccountControl codes.  For more information
 * about User Account Control codes in ActiveDirectory please see:
 * https://docs.microsoft.com/en-us/troubleshoot/windows-server/identity/useraccountcontrol-manipulate-account-properties
 *
 * We convert the decimal in a binary string and then map each 1 value in the string to the appropriate index in our
 * lookup map.
 * @param decimalUac
 * @returns {[]}
 */
function userAccountControlToStrings(decimalUac) {
  const codes = [];
  const uacBinary = dec2bin(decimalUac);
  // first tag is the decimal value of the code
  codes.push(decimalUac);
  for (let i = uacBinary.length - 1; i >= 0; i--) {
    if (uacBinary[i] === '1') {
      codes.push(USER_ACCOUNT_CONTROL_MAP[uacBinary.length - 1 - i]);
    }
  }
  return codes;
}

module.exports = {
  userAccountControlToStrings
};
