import Ember from 'ember';
import Evented from 'ember-evented';
import Service from 'ember-service';
import injectService from 'ember-service/inject';
import { A } from 'ember-array/utils';
import { isEmpty } from 'ember-utils';
import { throttle } from 'ember-runloop';

const { testing } = Ember;

export default Service.extend(Evented, {
  scrollActivity: injectService('ember-user-activity@scroll-activity'),

  EVENT_THROTTLE: 100,
  defaultEvents: ['keydown', 'mousedown', 'scroll'],
  enabledEvents: null,
  _eventsListened: null,

  _throttledEventHandlers: null,

  _boundEventHandler: null,
  handleEvent(event) {
    throttle(this, this._throttledEventHandlers[event.type], event, this.get('EVENT_THROTTLE'));
  },

  _handleScroll() {
    this.handleEvent({ type: 'scroll' });
  },

  _setupListeners() {
    this.enableEvents(this.get('defaultEvents'));
  },

  _listen(eventName) {
    if (eventName === 'scroll') {
      this.get('scrollActivity').on('scroll', this, this._handleScroll);
    } else if (this.get('_eventsListened').indexOf(eventName) === -1) {
      this.get('_eventsListened').pushObject(eventName);
      window.addEventListener(eventName, this._boundEventHandler, true);
    }

  },

  init() {
    this._super(...arguments);

    if (testing) { // Do not throttle in testing mode
      this.set('EVENT_THROTTLE', 0);
    }
    this.setProperties({
      _boundEventHandler: this.handleEvent.bind(this),
      _eventsListened: A(),
      _throttledEventHandlers: {}
    });
    if (isEmpty(this.get('enabledEvents'))) {
      this.set('enabledEvents', A());
    }
    this._setupListeners();
  },

  enableEvents(eventNames) {
    eventNames.forEach((eventName) => {
      this.enableEvent(eventName);
    });
  },

  enableEvent(eventName) {
    if (!this.isEnabled(eventName)) {
      this.get('enabledEvents').pushObject(eventName);
      this._throttledEventHandlers[eventName] = function fireEnabledEvent(event) {
        if (this.isEnabled(event.type)) {
          this.fireEvent(event);
        }
      };
      this._listen(eventName);
    }
  },

  disableEvents(eventNames) {
    eventNames.forEach((eventName) => {
      this.disableEvent(eventName);
    });
  },

  disableEvent(eventName) {
    this.get('enabledEvents').removeObject(eventName);
    this.set(`_throttledEventHandlers.${eventName}`, null);
    if (eventName === 'scroll') {
      this.get('scrollActivity').off('scroll', this, this._handleScroll);
    } else {
      window.removeEventListener(eventName, this._boundEventHandler, true);
    }
  },

  fireEvent(event) {
    // Only fire events that have subscribers
    if (this.has(event.type)) {
      this.trigger(event.type, event);
    }
    if (this.has('userActive')) {
      this.trigger('userActive', event);
    }
  },

  isEnabled(eventName) {
    return this.get('enabledEvents').indexOf(eventName) !== -1;
  },

  willDestroy() {
    this.disableEvents(this.get('_eventsListened'));

    this._super(...arguments);
  }
});
