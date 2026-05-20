declare module 'ical.js' {
  class Component {
    constructor(jCal: unknown[], parent?: Component);
    static fromString(str: string): Component;
    name: string;
    getFirstSubcomponent(name: string): Component | null;
    getAllSubcomponents(name: string): Component[];
    getFirstPropertyValue(name: string): unknown;
    getFirstProperty(name: string): Property | null;
    getAllProperties(name: string): Property[];
    addSubcomponent(comp: Component): void;
    removeAllProperties(name: string): void;
    toString(): string;
  }

  class Property {
    constructor(jCal: unknown[], component?: Component);
    name: string;
    getFirstValue(): unknown;
    getValues(): unknown[];
    getParameter(name: string): string | undefined;
    toJSON(): unknown[];
    toString(): string;
  }

  class Event {
    constructor(component: Component);
    uid: string;
    summary: string;
    description: string;
    location: string;
    organizer: string;
    startDate: Time;
    endDate: Time;
    component: Component;
  }

  class Time {
    constructor(data?: Record<string, unknown>);
    toJSDate(): Date;
    isDate: boolean;
    toString(): string;
    static fromJSDate(date: Date, useUtc?: boolean): Time;
    static fromDateTimeString(str: string): Time;
  }

  function parse(input: string): unknown[];
}
