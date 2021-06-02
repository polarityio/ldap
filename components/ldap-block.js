polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  timezone: Ember.computed('Intl', function () {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }),
  init: function () {
    if (!this.get('block.data.details._groups')) {
      this.set('block.data.details._groups', []);
    }
    this._super(...arguments);
  },
  actions: {
    toggleGroup: function (groupName, groupIndex) {

      const isLoaded = this.get(`block.data.details._groups.${groupIndex}.isLoaded`);

      // If we've already loaded the users for this group, then just toggle the expansion flag
      // which is used to control whether we show the user in the template
      if(isLoaded){
        this.toggleProperty(`block.data.details._groups.${groupIndex}.isExpanded`);
        return;
      }

      // Users are not yet loaded so go through the loading process.
      const payload = {
        group: groupName
      };

      if (!this.get(`block.data.details._groups.${groupIndex}`)) {
        this.set(`block.data.details._groups.${groupIndex}`, {});
      }
      this.set(`block.data.details._groups.${groupIndex}.isLoading`, true);
      this.sendIntegrationMessage(payload)
        .then((result) => {
          this.set(`block.data.details._groups.${groupIndex}.users`, result.users);
          this.set(`block.data.details._groups.${groupIndex}.isLoaded`, true);
          this.set(`block.data.details._groups.${groupIndex}.isExpanded`, true);
        })
        .finally(() => {
          this.set(`block.data.details._groups.${groupIndex}.isLoading`, false);
        });
    }
  }
});
