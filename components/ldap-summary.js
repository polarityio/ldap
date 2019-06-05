polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  summaryAttributes: Ember.computed(
    'block.userOptions.summaryUserAttributes',
    'block.data.details',
    function() {
      const summaryUserAttributes = this.get(
        'block.userOptions.summaryUserAttributes'
      );
      const customSummaryUserAttributes = this.get(
        'block.userOptions.summaryCustomUserAttributes'
      );
      const values = [];
      const userDetails = this.get('block.data.details.userSummaryHash');

      summaryUserAttributes.forEach((userAttribute) => {
        if (userDetails[userAttribute.value]) {
          values.push(userDetails[userAttribute.value]);
        }
      });

      customSummaryUserAttributes
        .split(',')
        .map((attr) => attr.trim())
        .forEach((value) => {
          if (userDetails[value]) {
            values.push(userDetails[value]);
          }
        });

      return values;
    }
  )
});
