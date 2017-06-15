# entity-schema

entity-schema is an interface for JSON API entity schemas. entity-schema will be useful to you if you are using [JSON Schema](http://json-schema.org/) to model your entities according to the [JSON API Rsource Object spec](http://jsonapi.org/format/#document-resource-objects). It allows you to do things like retrieve all field schemas or retrieve a relationship schema by name. entity-schema is still in early development. It should not be considered stable and there are many new features planned!

## Usage

Suppose you have the following entity schema:

```json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "required": [
    "type",
    "id"
  ],
  "properties": {
    "type": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "attributes": {
      "type": "object",
      "properties": {
        "firstName": { "type": "string" },
        "lastName": { "type": "string" },
        "age": { "type": "number" },
        "bio": { "type": "string" }
      }
    },
    "relationships": {
      "type": "object",
      "properties": {
        "role": {
          "$ref": "role.json#/definitions/roleSingleRelationship"
        },
        "groups": {
          "$ref": "group.json#/definitions/groupMultipleRelationship"
        }
      }
    }
  }
}
```

Using entity-schema, you can do things like this:

```javascript
const Schema = require('entity-schema');
const rawSchema = require('./person.json');
const schema = new Schema(rawSchema);

// Get all fields.
const fields = schema.getFields();
// returns:
// {
//   firstName: { type: "string" },
//   lastName: { type: "string" },
//   age: { type: "number" },
//   bio: { type: "string" },
//   role: { ...fully dereffed role relationship definition },
//   groups: { ...fully dereffed groups relationship definition },
// }

// Get all relationships.
const relationships = schema.getRelationships();
// returns:
// {
//   role: { ...fully dereffed role relationship definition },
//   groups: { ...fully dereffed groups relationship definition },
// }

// Get a specific attribute definition.
const attributes = schema.getAttributes('firstName');
// returns:
// {
//   firstName: { type: "string" }
// }
```
