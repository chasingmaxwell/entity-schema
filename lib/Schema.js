const deref = require('json-schema-deref');
const _ = require('lodash');

class Schema {

  /**
   * Construct a schema interface.
   *
   * @param {Object} schema
   *   The raw schema with which to interface.
   * @param {Object} config
   *   Configuration for the schema interface.
   */
  constructor(schema, config = {}) {
    this.rawSchema = schema;
    this.config = config;
  }

  /**
   * Process the raw schema and store the result.
   *
   * Processing consists of dereferencing and validation.
   *
   * @return {Promise.<Object, Error>}
   *   A promise which returns the processed schema object.
   */
  process() {
    return Schema.deref(this.rawSchema, _.get(this.config, 'deref'))
      .then((dereffedSchema) => {
        Schema.validate(dereffedSchema);
        this.schema = dereffedSchema;
        return this.schema;
      });
  }

  /**
   * Dereference the schema object.
   *
   * @param {Object} schema
   *   The schema to dereference.
   * @param {Object} derefConfig
   *   The configuration to pass to json-schema-deref.
   *
   * @return {Promise.<Object, Error>}
   *   A promise which returns the dereferenced schema object.
   */
  static deref(schema, derefConfig = {}) {
    return new Promise((resolve, reject) => {
      deref(schema, derefConfig, (err, res) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  /**
   * Validate schema.
   *
   * @TODO:
   * - use actual json schema validation on json schema that describes JSON API.
   *
   * @throws Error
   *   Throws an error if the schema does not validate.
   */
  static validate(schema) {
    if (!_.has(schema, 'required')) {
      throw new Error('Schema must require the "id" and "type" properties');
    }

    ['id', 'type'].forEach((requiredProp) => {
      if (
        !_.has(schema, `properties.${requiredProp}`)
        || !schema.required.includes(requiredProp)
      ) {
        throw new Error(`Schema must require the property "${requiredProp}"`);
      }
      else if (schema.properties[requiredProp].type !== 'string') {
        throw new Error(`Schema must require a type of "string" for the "${requiredProp}" property`);
      }
    });

    if (_.has(schema.properties, 'attributes') && _.has(schema.properties, 'relationships')) {
      const overlap = _.intersection(
        Object.keys(schema.properties.attributes),
        Object.keys(schema.properties.relationships)
      );
      if (overlap.length > 0) {
        throw new Error(`Schema must not allow multiple fields with the same name. The following fields are present in both attributes and relationships: ${overlap.join(', ')}`);
      }
    }
  }

  /**
   * Get the processed schema object.
   *
   * @return {Promise.<Object, Error>}
   *   A promise which returns the processed schema object.
   */
  getSchema() {
    return this.schema ? Promise.resolve(this.schema) : this.process();
  }

  /**
   * Get all field definitions of the given type(s).
   *
   * @param {String|Array} fieldNames
   *   The name or names of the fields to return.
   * @param {String|Array} fieldTypes
   *   The field type or types to return.
   *
   * @return {Promise.<Object, Error>}
   *   A promise which resolves with an object containing every field definition
   *   matching the given name(s) and type(s).
   */
  getFieldsByType(fieldNames, fieldTypes) {
    const names = [].concat(fieldNames).filter(_.identity);
    const types = [].concat(fieldTypes).filter(_.identity);
    return this.getSchema()
      // get all fields.
      .then(schema => Object.assign({}, ...types.map(type => _.get(schema, `properties.${type}.properties`))))
      // filter to only the fields requested.
      .then(fields => (names.length > 0 ? _.pick(fields, names) : fields))
      .then((fields) => {
        const missing = _.difference(names, Object.keys(fields));
        if (missing.length > 0) {
          throw new Error(`The following fields do not exist on the schema: ${missing.join(', ')}`);
        }
        return fields;
      });
  }

  /**
   * A convenience method which gets attribute definitions.
   *
   * @see Schema.getFieldsByType()
   *
   * @param {String|Array} fieldNames
   *   The name or names of the fields to return. If empty, all attributes will
   *   be retrieved.
   *
   * @return {Promise.<Object, Error>}
   *   A promise which resolves with an object containing every attribute
   *   definition matching the given name(s).
   */
  getAttributes(fieldNames) {
    return this.getFieldsByType(fieldNames, 'attributes');
  }

  /**
   * A convenience method which gets relationship definitions.
   *
   * @see Schema.getFieldsByType()
   *
   * @param {String|Array} fieldNames
   *   The name or names of the fields to return. If empty, all relationships
   *   will be retrieved.
   *
   * @return {Promise.<Object, Error>}
   *   A promise which resolves with an object containing every relationship
   *   definition matching the given name(s).
   */
  getRelationships(fieldNames) {
    return this.getFieldsByType(fieldNames, 'relationships');
  }

  /**
   * A convenience method which gets field definitions of all types.
   *
   * @see Schema.getFieldsByType()
   *
   * @param {String|Array} fieldNames
   *   The name or names of the fields to return. If empty, all fields will be
   *   retrieved.
   *
   * @return {Promise.<Object, Error>}
   *   A promise which resolves with an object containing every field definition
   *   matching the given name(s) and type(s).
   */
  getFields(fieldNames) {
    return this.getFieldsByType(fieldNames, ['attributes', 'relationships']);
  }

}

module.exports = Schema;
