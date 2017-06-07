const deref = require('json-schema-deref');
const _ = require('lodash');

class Schema {

  /**
   * Construct a schema interface.
   *
   * @param {Object} schema
   *   The raw schema with which to interface.
   */
  constructor(schema) {
    this.rawSchema = schema;
  }

  /**
   * Process the raw schema and store the result.
   *
   * Processing consists of dereferencing and validation.
   *
   * @return {Object}
   *   The processed schema object.
   */
  process() {
    return Schema.deref(this.rawSchema)
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
   * @return {Object}
   *   The dereferenced schema object.
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
      const overlap = _.intersection(Object.keys(schema.properties.attributes), Object.keys(schema.properties.relationships));
      if (overlap.length > 0) {
        throw new Error(`Schema must not allow multiple fields with the same name. The following fields are present in both attributes and relationships: ${overlap.join(', ')}`);
      }
    }
  }

  /**
   * Get the processed schema object.
   */
  getSchema() {
    return this.schema ? Promise.resolve(this.schema) : this.process();
  }

  /**
   * Get all field definitions of the given type(s).
   *
   * @param {String|Array} fieldTypes
   *   The field type or types to return.
   *
   * @return {Object}
   *   An object containing every field definition matching the given type(s).
   */
  getFieldsByType(fieldTypes) {
    const types = Array.isArray(fieldTypes) ? fieldTypes : [fieldTypes];
    return this.getSchema()
      .then(schema => Object.assign({}, ...types.map(type => _.get(schema, `properties.${type}`))));
  }

  /**
   * Get all attribute definitions.
   */
  getAttributes() {
    return this.getFieldsByType('attributes');
  }

  /**
   * Get all relationship definitions.
   */
  getRelationships() {
    return this.getFieldsByType('relationships');
  }

  /**
   * Get all field definitions.
   */
  getFields() {
    return this.getFieldsByType(['attributes', 'relationships']);
  }

}

module.exports = Schema;
