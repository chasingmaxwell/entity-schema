jest.mock('json-schema-deref');
const deref = require('json-schema-deref');
const Schema = require('../../lib/Schema');
const _ = require('lodash');

describe('The Schema class', () => {
  beforeEach(() => {
    deref.mockReset();
  });

  describe('schema dereferencing', () => {
    test('can dereference schemas', () => {
      expect.assertions(2);
      const expected = { aThing: 'yay' };
      deref.mockImplementation((s, c, callback) => callback(null, expected));
      return Schema.deref({})
        .then((res) => {
          expect(deref.mock.calls[0].slice(0, 2)).toEqual([{}, {}]);
          expect(res).toEqual(expected);
        });
    });

    test('passes config to json-schema-deref', () => {
      expect.assertions(2);
      const expected = { aThing: 'yay' };
      const expectedConfig = { testConfig: true };
      deref.mockImplementation((s, c, callback) => callback(null, expected));
      return Schema.deref({}, expectedConfig)
        .then((res) => {
          expect(deref.mock.calls[0].slice(0, 2)).toEqual([{}, expectedConfig]);
          expect(res).toEqual(expected);
        });
    });

    test('rejects with dereference errors', () => {
      expect.assertions(2);
      const expected = new Error('whoops');
      deref.mockImplementation((s, c, callback) => callback(new Error('whoops')));
      return Schema.deref({})
        .catch((err) => {
          expect(deref.mock.calls[0].slice(0, 2)).toEqual([{}, {}]);
          expect(err).toEqual(expected);
        });
    });
  });

  describe('schema validation', () => {
    let schema;
    const requiredProps = ['id', 'type'];

    beforeEach(() => {
      schema = {
        required: requiredProps,
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          attributes: {
            someThing: { type: 'string' },
          },
          relationships: {
            someOtherThing: { id: { type: 'string' }, type: { type: 'string' } },
          },
        },
      };
    });

    test('passes valid schemas', () => {
      expect(() => Schema.validate(schema))
        .not.toThrow();
    });

    test('requires required fields', () => {
      expect(() => Schema.validate(_.pick(schema, 'properties')))
        .toThrow('Schema must require the "id" and "type" properties');
    });

    requiredProps.forEach(requiredProp => test(`requires the "${requiredProp}" property`, () => {
      const changeSchema = Object.assign({}, schema);

      changeSchema.required = _.without(requiredProps, requiredProp);
      expect(() => Schema.validate(changeSchema))
        .toThrow(`Schema must require the property "${requiredProp}"`);

      changeSchema.required = schema.required;
      changeSchema.properties[requiredProp].type = 'notAString';
      expect(() => Schema.validate(changeSchema))
        .toThrow(`Schema must require a type of "string" for the "${requiredProp}" property`);

      delete changeSchema.properties[requiredProp];
      expect(() => Schema.validate(changeSchema))
        .toThrow(`Schema must require the property "${requiredProp}"`);
    }));

    test('does not allow field overlap', () => {
      schema.properties.attributes = { same: {}, thing: {} };
      schema.properties.relationships = schema.properties.attributes;
      expect(() => Schema.validate(schema)).toThrow('Schema must not allow multiple fields with the same name. The following fields are present in both attributes and relationships: same, thing');
      delete schema.properties.attributes;
      expect(() => Schema.validate(schema)).not.toThrow();
    });
  });
});

describe('An instance of the Schema class', () => {
  test('can be constructed', () => {
    const expected = { aThing: true };
    const schema = new Schema(expected);
    expect(schema.rawSchema).toEqual(expected);
  });

  test('can be processed', () => {
    expect.assertions(4);
    const expected = { aThing: true };
    jest.spyOn(Schema, 'deref').mockReturnValue(Promise.resolve(expected));
    jest.spyOn(Schema, 'validate').mockReturnValue(null);
    const schema = new Schema(expected);
    return schema.process()
      .then((processed) => {
        expect(processed).toEqual(expected);
        expect(schema.schema).toEqual(expected);
        expect(Schema.deref).toHaveBeenCalledWith(expected, undefined);
        expect(Schema.validate).toHaveBeenCalledWith(expected);
        Schema.deref.mockRestore();
        Schema.validate.mockRestore();
      });
  });

  test('can retrieve its processed schema', () => {
    expect.assertions(2);
    const expected = { aThing: true };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'process').mockReturnValue(Promise.resolve(expected));
    return schema.getSchema()
      .then((processed) => {
        expect(processed).toEqual(expected);
        expect(schema.process).toHaveBeenCalled();
        schema.process.mockRestore();
      });
  });

  test('can retrieve a processed schema without re-processing', () => {
    expect.assertions(2);
    const expected = { aThing: true };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'process').mockReturnValue(Promise.resolve(expected));
    schema.schema = expected;
    return schema.getSchema()
      .then((processed) => {
        expect(processed).toEqual(expected);
        expect(schema.process).not.toHaveBeenCalled();
        schema.process.mockRestore();
      });
  });

  test('can retrieve fields of a single type', () => {
    expect.assertions(2);
    const expected = { properties: { attributes: { aThing: { type: 'string' } } } };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'getSchema').mockReturnValue(Promise.resolve(expected));
    return schema.getFieldsByType(undefined, 'attributes')
      .then((attributes) => {
        expect(attributes).toEqual(expected.properties.attributes);
        expect(schema.getSchema).toHaveBeenCalled();
        schema.getSchema.mockRestore();
      });
  });

  test('can retrieve fields of multiple types', () => {
    expect.assertions(2);
    const expected = {
      properties: {
        attributes: { aThing: { type: 'string' } },
        relationships: { anotherThing: { type: 'number' } },
      },
    };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'getSchema').mockReturnValue(Promise.resolve(expected));
    return schema.getFieldsByType(undefined, ['attributes', 'relationships'])
      .then((fields) => {
        expect(fields).toEqual(Object.assign(
          {},
          expected.properties.relationships,
          expected.properties.attributes
        ));
        expect(schema.getSchema).toHaveBeenCalled();
        schema.getSchema.mockRestore();
      });
  });

  test('can retrieve a field by name', () => {
    expect.assertions(2);
    const expected = {
      properties: {
        attributes: { aThing: { type: 'string' }, ignoreMe: { type: 'number' } },
        relationships: { anotherThing: { type: 'number' } },
      },
    };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'getSchema').mockReturnValue(Promise.resolve(expected));
    return schema.getFieldsByType('aThing', ['attributes', 'relationships'])
      .then((fields) => {
        expect(fields).toEqual(_.pick(expected.properties.attributes, ['aThing']));
        expect(schema.getSchema).toHaveBeenCalled();
        schema.getSchema.mockRestore();
      });
  });

  test('can retrieve multiple fields by name', () => {
    expect.assertions(2);
    const expected = {
      properties: {
        attributes: { aThing: { type: 'string' }, hello: { type: 'string' }, ignoreMe: { type: 'number' } },
      },
    };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'getSchema').mockReturnValue(Promise.resolve(expected));
    return schema.getFieldsByType(['aThing', 'hello'], 'attributes')
      .then((fields) => {
        expect(fields).toEqual(_.pick(expected.properties.attributes, ['aThing', 'hello']));
        expect(schema.getSchema).toHaveBeenCalled();
        schema.getSchema.mockRestore();
      });
  });

  test('throws an error for missing fields', () => {
    expect.assertions(2);
    const expected = {
      properties: {
        attributes: { aThing: { type: 'string' }, hello: { type: 'string' }, ignoreMe: { type: 'number' } },
      },
    };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'getSchema').mockReturnValue(Promise.resolve(expected));
    return schema.getFieldsByType(['aThing', 'nonExistant'], ['attributes', 'relationships'])
      .catch((err) => {
        expect(err.message).toEqual('The following fields do not exist on the schema: nonExistant');
        expect(schema.getSchema).toHaveBeenCalled();
        schema.getSchema.mockRestore();
      });
  });

  test('returns an empty object when retrieving missing field types', () => {
    expect.assertions(2);
    const expected = { properties: {} };
    const schema = new Schema(expected);
    jest.spyOn(schema, 'getSchema').mockReturnValue(Promise.resolve(expected));
    return schema.getFieldsByType(undefined, ['attributes', 'relationships'])
      .then((fields) => {
        expect(fields).toEqual({});
        expect(schema.getSchema).toHaveBeenCalled();
        schema.getSchema.mockRestore();
      });
  });

  test('can retrieve fields with convenience methods', () => {
    expect.assertions(3);
    const schema = new Schema({});
    jest.spyOn(schema, 'getFieldsByType');
    schema.getAttributes();
    expect(schema.getFieldsByType).toHaveBeenCalledWith(undefined, 'attributes');
    schema.getRelationships();
    expect(schema.getFieldsByType).toHaveBeenCalledWith(undefined, 'relationships');
    schema.getFields();
    expect(schema.getFieldsByType).toHaveBeenCalledWith(undefined, ['attributes', 'relationships']);
  });
});
