function simpleGroupName(fullyQualifiedGroup){
  const groupTokens = fullyQualifiedGroup.split(',');
  if(groupTokens.length > 0){
    const groupParts = groupTokens[0].split('=');
    if(groupParts.length >= 2){
      return groupParts[1];
    }
  }
  return 'Unable to parse group';
}

module.exports = {
  simpleGroupName
}