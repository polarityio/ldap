polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  summaryAttributes: Ember.computed(
    'block.data.details.userOptions',
    function () {
      const summaryUserAttributes = this.get(
        'details.userOptions.summaryUserAttributes'
      );
      const customSummaryUserAttributes = this.get(
        'details.userOptions.summaryCustomUserAttributes'
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

      if (values.length === 0) {
        values.push({
          value: 'User Found'
        });
      }

      return values;
    }
  )
});
