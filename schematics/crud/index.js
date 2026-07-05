"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crud = crud;
const schematics_1 = require("@angular-devkit/schematics");
const ts = require("typescript");
const pluralize_1 = require("pluralize");
function crud(options) {
    return (tree, context) => {
        const entityName = normalizeEntityName(options.name);
        const entityPath = resolveEntityPath(tree, entityName);
        const entity = parseEntity(tree.readText(entityPath), entityPath);
        const templateSource = (0, schematics_1.apply)((0, schematics_1.url)('./files'), [
            (0, schematics_1.applyTemplates)({
                ...schematics_1.strings,
                entity,
                entityName,
                plural: pluralize_1.plural,
                camelize,
                titleize,
                fieldLabelKey,
                renderCreateDtoFields,
                renderQueryDtoFields,
                renderCreateDtoImports,
                renderQueryDtoImports,
                renderQueryInputs,
                renderTableHeaders,
                renderTableCells,
                renderFormInputs,
                renderDetailRows,
                renderI18nJson,
                renderStatusToggleScript,
                hasStatusField,
                hasDefaultOrder,
                defaultOrderField,
                fuzzyFields,
            }),
            (0, schematics_1.move)('/'),
        ]);
        return (0, schematics_1.chain)([
            (0, schematics_1.mergeWith)(templateSource),
            updateAdminModule(entityName),
            updateApiModule(entityName),
            updateSharedModule(entityName, entity.className),
            updateDtoIndex(entityName),
            () => {
                context.logger.info(`Generated CRUD for ${schematics_1.strings.classify(entityName)}`);
            },
        ])(tree, context);
    };
}
function parseEntity(sourceText, entityPath) {
    var _a;
    const sourceFile = ts.createSourceFile(entityPath, sourceText, ts.ScriptTarget.Latest, true);
    let entityClass;
    visit(sourceFile, (node) => {
        if (ts.isClassDeclaration(node) && hasDecorator(node, 'Entity')) {
            entityClass = node;
        }
    });
    if (!(entityClass === null || entityClass === void 0 ? void 0 : entityClass.name)) {
        throw new Error(`No @Entity class found in ${entityPath}`);
    }
    const fields = [];
    for (const member of entityClass.members) {
        if (!ts.isPropertyDeclaration(member) || !member.name)
            continue;
        const decoratorName = getColumnDecorator(member);
        if (!decoratorName)
            continue;
        const name = member.name.getText(sourceFile);
        const decoratorText = getDecoratorText(member, decoratorName, sourceFile);
        const options = parseColumnOptions(decoratorText);
        fields.push({
            name,
            columnName: options.name || snakeCase(name),
            type: ((_a = member.type) === null || _a === void 0 ? void 0 : _a.getText(sourceFile)) || 'string',
            columnType: options.type,
            comment: options.comment,
            nullable: options.nullable,
            hasDefault: options.hasDefault,
            primary: decoratorName === 'PrimaryGeneratedColumn',
            generated: decoratorName === 'PrimaryGeneratedColumn' ||
                decoratorName === 'CreateDateColumn' ||
                decoratorName === 'UpdateDateColumn',
        });
    }
    const columns = fields.filter((field) => !field.generated);
    return {
        className: entityClass.name.text,
        fields,
        columns,
        displayFields: fields.filter((field) => !isSecretField(field)),
        listFields: columns.filter((field) => !isSecretField(field)).slice(0, 5),
    };
}
function updateAdminModule(entityName) {
    return updateFile('/src/admin/admin.module.ts', (content) => {
        const className = `${schematics_1.strings.classify(entityName)}Controller`;
        return addImport(addArrayItem(content, 'controllers', className), className, `./controllers/${entityName}.controller`);
    });
}
function updateApiModule(entityName) {
    return updateFile('/src/api/api.module.ts', (content) => {
        const className = `${schematics_1.strings.classify(entityName)}Controller`;
        return addImport(addArrayItem(content, 'controllers', className), className, `./controller/${entityName}.controller`);
    });
}
function updateSharedModule(entityName, entityClassName) {
    return updateFile('/src/shared/shared.module.ts', (content) => {
        const serviceName = `${schematics_1.strings.classify(entityName)}Service`;
        let next = addImport(content, serviceName, `./services/${entityName}.service`);
        next = addImport(next, entityClassName, `./entities/${entityName}.entity`);
        next = addTypeOrmFeature(next, entityClassName);
        next = addArrayItem(next, 'providers', serviceName);
        next = addArrayItem(next, 'exports', serviceName);
        return next;
    });
}
function updateDtoIndex(entityName) {
    return updateFile('/src/api/dto/index.ts', (content) => {
        let next = addExport(content, `./${entityName}/${entityName}-create.dto`);
        next = addExport(next, `./${entityName}/${entityName}-update.dto`);
        return next;
    });
}
function normalizeEntityName(name) {
    return schematics_1.strings.dasherize(name);
}
function resolveEntityPath(tree, entityName) {
    const candidates = [
        entityName,
        schematics_1.strings.dasherize(schematics_1.strings.camelize(entityName)),
        schematics_1.strings.dasherize(schematics_1.strings.classify(entityName)),
    ]
        .filter((value, index, values) => values.indexOf(value) === index)
        .map((value) => `/src/shared/entities/${value}.entity.ts`);
    const entityPath = candidates.find((candidate) => tree.exists(candidate));
    if (!entityPath) {
        throw new Error(`Entity not found. Tried: ${candidates.join(', ')}`);
    }
    return entityPath;
}
function updateFile(filePath, updater) {
    return (tree) => {
        if (!tree.exists(filePath))
            return tree;
        const content = tree.readText(filePath);
        const next = updater(content);
        if (next !== content)
            tree.overwrite(filePath, next);
        return tree;
    };
}
function renderCreateDtoImports(entity) {
    return collectDtoImports(entity.columns);
}
function renderQueryDtoImports(entity) {
    return collectQueryImports(entity.columns.filter((field) => !isSecretField(field)));
}
function renderCreateDtoFields(entity) {
    return entity.columns.map(renderDtoField).join('\n\n');
}
function renderQueryDtoFields(entity) {
    return entity.columns
        .filter((field) => !isSecretField(field))
        .map(renderQueryField)
        .join('\n\n');
}
function renderQueryInputs(entityName, entity) {
    return entity.listFields.slice(0, 4).map((field) => renderQueryInput(entityName, field)).join('\n');
}
function renderTableHeaders(entityName, entity) {
    return entity.listFields
        .map((field) => `      <th>${fieldLabel(entityName, field)}</th>`)
        .join('\n');
}
function renderTableCells(entity) {
    return entity.listFields.map((field) => `        <td>${fieldValue(field)}</td>`).join('\n');
}
function renderFormInputs(entityName, entity) {
    return entity.columns
        .filter((field) => !field.primary)
        .map((field) => renderFormInput(entityName, field))
        .join('\n');
}
function renderDetailRows(entityName, entity) {
    const variableName = camelize(entityName);
    return entity.displayFields
        .map((field) => `    <tr>
      <th class='table-light text-nowrap'>${fieldLabel(entityName, field)}</th>
      <td>${detailValue(entityName, variableName, field)}</td>
    </tr>`)
        .join('\n');
}
function renderI18nJson(entityName, entity, useComments) {
    const labels = {};
    for (const field of entity.displayFields) {
        labels[field.columnName] = useComments && field.comment ? field.comment : titleize(field.name);
    }
    return JSON.stringify({
        list_title: `${titleize(entityName)} List`,
        form_title_create: `Create ${titleize(entityName)}`,
        form_title_update: `Edit ${titleize(entityName)}`,
        detail_title: `${titleize(entityName)} Detail`,
        add: `Add ${titleize(entityName)}`,
        search: 'Search',
        export: 'Export',
        view: 'View',
        edit: 'Edit',
        delete: 'Delete',
        back: 'Back',
        field: labels,
        status: {
            placeholder: 'Choose...',
            inactive: 'Inactive',
            active: 'Active',
        },
        boolean: {
            yes: 'Yes',
            no: 'No',
        },
    }, null, 2);
}
function renderStatusToggleScript(entityName, entity) {
    if (!hasStatusField(entity))
        return '';
    return `    $('.js-status-toggle').on('change', function () {
      var $input = $(this)
      var id = $input.closest('tr').data('id')
      $input.prop('disabled', true)
      $.ajax({
        url: '/admin/${(0, pluralize_1.plural)(entityName)}' + '/' + id + '/status',
        method: 'PUT',
      })
        .done(function (res) {
          $input.prop('checked', res.status === 1)
        })
        .fail(function () {
          $input.prop('checked', !$input.prop('checked'))
          alert('Status update failed')
        })
        .always(function () {
          $input.prop('disabled', false)
        })
    })
`;
}
function hasStatusField(entity) {
    return entity.columns.some((field) => field.name === 'status');
}
function hasDefaultOrder(entity) {
    return Boolean(defaultOrderField(entity));
}
function defaultOrderField(entity) {
    var _a;
    return ((_a = entity.columns.find((field) => field.name === 'sort')) === null || _a === void 0 ? void 0 : _a.name) || '';
}
function fuzzyFields(entity) {
    return entity.columns
        .filter((field) => isStringField(field) && !isSecretField(field))
        .map((field) => `'${field.name}'`)
        .join(', ');
}
function renderDtoField(field) {
    const optional = field.nullable || field.hasDefault;
    const decorators = optional ? ['@IsOptional()'] : [];
    if (isNumberField(field)) {
        decorators.push('@Type(() => Number)', '@IsNumber()');
    }
    else if (isBooleanField(field)) {
        decorators.push('@Type(() => Boolean)', '@IsBoolean()');
    }
    else if (isDateField(field)) {
        decorators.push('@Type(() => Date)', '@IsDate()');
    }
    else {
        if (optional)
            decorators.push('@EmptyStringToUndefined()');
        decorators.push('@IsString()');
    }
    return `${decorators.join('\n')}\n${field.name}${optional ? '?' : '!'}: ${field.type}`;
}
function renderQueryField(field) {
    const decorators = ['@IsOptional()'];
    if (isNumberField(field)) {
        decorators.push('@Type(() => Number)', '@IsNumber()');
    }
    else if (isBooleanField(field)) {
        decorators.push('@Transform(({ value }) => {', "  if (value === 'true' || value === '1' || value === true) return true", "  if (value === 'false' || value === '0' || value === false) return false", '  return undefined', '})', '@IsBoolean()');
    }
    else if (isDateField(field)) {
        decorators.push('@Type(() => Date)', '@IsDate()');
    }
    else {
        decorators.push('@EmptyStringToUndefined()', '@IsString()');
    }
    return `${decorators.join('\n')}\n${field.name}?: ${field.type}`;
}
function collectDtoImports(fields) {
    const validators = new Set();
    let needsType = false;
    let needsEmpty = false;
    for (const field of fields) {
        if (field.nullable || field.hasDefault)
            validators.add('IsOptional');
        if (isNumberField(field)) {
            validators.add('IsNumber');
            needsType = true;
        }
        else if (isBooleanField(field)) {
            validators.add('IsBoolean');
            needsType = true;
        }
        else if (isDateField(field)) {
            validators.add('IsDate');
            needsType = true;
        }
        else {
            validators.add('IsString');
            needsEmpty = needsEmpty || field.nullable || field.hasDefault;
        }
    }
    return [
        needsType ? "import { Type } from 'class-transformer'" : '',
        `import { ${Array.from(validators).sort().join(', ')} } from 'class-validator'`,
        needsEmpty
            ? "import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'"
            : '',
    ]
        .filter(Boolean)
        .join('\n');
}
function collectQueryImports(fields) {
    const validators = new Set(['IsOptional']);
    let needsType = false;
    let needsTransform = false;
    let needsEmpty = false;
    for (const field of fields) {
        if (isNumberField(field)) {
            validators.add('IsNumber');
            needsType = true;
        }
        else if (isBooleanField(field)) {
            validators.add('IsBoolean');
            needsTransform = true;
        }
        else if (isDateField(field)) {
            validators.add('IsDate');
            needsType = true;
        }
        else {
            validators.add('IsString');
            needsEmpty = true;
        }
    }
    return [
        needsType || needsTransform
            ? `import { ${[needsTransform ? 'Transform' : '', needsType ? 'Type' : ''].filter(Boolean).join(', ')} } from 'class-transformer'`
            : '',
        `import { ${Array.from(validators).sort().join(', ')} } from 'class-validator'`,
        needsEmpty
            ? "import { EmptyStringToUndefined } from '../../../shared/decorator/empty-string-to-undefined.decorator'"
            : '',
    ]
        .filter(Boolean)
        .join('\n');
}
function renderQueryInput(entityName, field) {
    if (field.name === 'status') {
        return `  <div class='d-flex align-items-center field-item'>
    <label class='me-2 text-nowrap' for='status'>${fieldLabel(entityName, field)}</label>
    <select class='form-select' id='status' name='status' aria-label='status'>
      <option value=''>{{t '${entityName}.status.placeholder'}}</option>
      <option value='0' {{#if (eq query.status 0)}}selected{{/if}}>{{t '${entityName}.status.inactive'}}</option>
      <option value='1' {{#if (eq query.status 1)}}selected{{/if}}>{{t '${entityName}.status.active'}}</option>
    </select>
  </div>`;
    }
    return `  <div class='d-flex align-items-center field-item'>
    <label class='me-2 text-nowrap' for='${field.name}'>${fieldLabel(entityName, field)}</label>
    <input type='${inputType(field)}' class='form-control' id='${field.name}' name='${field.name}' value='{{query.${field.name}}}' />
  </div>`;
}
function renderFormInput(entityName, field) {
    const variableName = camelize(entityName);
    if (field.name === 'status') {
        return `  <div class='mb-3'>
    <label for='status' class='form-label'>${fieldLabel(entityName, field)}</label>
    <select class='form-select' id='status' name='status' aria-label='status'>
      <option value=''>{{t '${entityName}.status.placeholder'}}</option>
      <option value='0' {{#if (eq ${variableName}.status 0)}}selected{{/if}}>{{t '${entityName}.status.inactive'}}</option>
      <option value='1' {{#if (eq ${variableName}.status 1)}}selected{{/if}}>{{t '${entityName}.status.active'}}</option>
    </select>
  </div>`;
    }
    if (isBooleanField(field)) {
        return `  <div class='mb-3'>
    <label for='${field.name}' class='form-label'>${fieldLabel(entityName, field)}</label>
    <select class='form-select' id='${field.name}' name='${field.name}' aria-label='${field.name}'>
      <option value=''>{{t '${entityName}.status.placeholder'}}</option>
      <option value='true' {{#if ${variableName}.${field.name}}}selected{{/if}}>{{t '${entityName}.boolean.yes'}}</option>
      <option value='false' {{#unless ${variableName}.${field.name}}}selected{{/unless}}>{{t '${entityName}.boolean.no'}}</option>
    </select>
  </div>`;
    }
    return `  <div class='mb-3'>
    <label for='${field.name}' class='form-label'>${fieldLabel(entityName, field)}</label>
    <input type='${inputType(field)}' name='${field.name}' class='form-control' id='${field.name}' value='{{${variableName}.${field.name}}}' />
  </div>`;
}
function fieldLabel(entityName, field) {
    return `{{t '${entityName}.field.${field.columnName}'}}`;
}
function fieldLabelKey(field) {
    return field.columnName;
}
function fieldValue(field) {
    if (field.name === 'status') {
        return `<div class='form-check form-switch m-0 ps-0 d-flex justify-content-center align-items-center'>
            <input type='checkbox' class='form-check-input m-0 js-status-toggle' role='switch' {{#unless (eq this.status 0)}}checked{{/unless}} />
          </div>`;
    }
    if (isDateField(field))
        return `{{formatDate this.${field.name}}}`;
    return `{{this.${field.name}}}`;
}
function detailValue(entityName, variableName, field) {
    if (field.name === 'status') {
        return `{{#if (eq ${variableName}.status 0)}}<span class='badge bg-secondary'>{{t '${entityName}.status.inactive'}}</span>{{else}}<span class='badge bg-success'>{{t '${entityName}.status.active'}}</span>{{/if}}`;
    }
    if (isBooleanField(field)) {
        return `{{#if ${variableName}.${field.name}}}{{t '${entityName}.boolean.yes'}}{{else}}{{t '${entityName}.boolean.no'}}{{/if}}`;
    }
    if (isDateField(field))
        return `{{formatDate ${variableName}.${field.name}}}`;
    return `{{${variableName}.${field.name}}}`;
}
function addImport(content, identifier, modulePath) {
    if (content.includes(`import { ${identifier} } from '${modulePath}'`))
        return content;
    return `import { ${identifier} } from '${modulePath}'\n${content}`;
}
function addArrayItem(content, property, item) {
    if (new RegExp(`${property}\\s*:\\s*\\[[^\\]]*\\b${item}\\b`, 's').test(content)) {
        return content;
    }
    return content.replace(new RegExp(`(${property}\\s*:\\s*\\[)([^\\]]*)(\\])`, 's'), (_match, start, body, end) => {
        const trimmed = body.trim();
        return `${start}${trimmed ? `${trimmed}, ${item}` : item}${end}`;
    });
}
function addTypeOrmFeature(content, item) {
    if (new RegExp(`TypeOrmModule\\.forFeature\\(\\[[^\\]]*\\b${item}\\b`, 's').test(content)) {
        return content;
    }
    return content.replace(/TypeOrmModule\.forFeature\(\[([^\]]*)\]\)/s, (_match, body) => {
        const trimmed = body.trim();
        return `TypeOrmModule.forFeature([${trimmed ? `${trimmed}, ${item}` : item}])`;
    });
}
function addExport(content, modulePath) {
    const line = `export * from '${modulePath}'`;
    if (content.includes(line))
        return content;
    return `${content.trimEnd()}\n${line}\n`;
}
function parseColumnOptions(decoratorText) {
    return {
        type: cleanOption(matchOption(decoratorText, 'type')),
        name: cleanOption(matchOption(decoratorText, 'name')),
        comment: cleanOption(matchOption(decoratorText, 'comment')),
        nullable: /nullable\s*:\s*true/.test(decoratorText),
        hasDefault: /default\s*:/.test(decoratorText),
    };
}
function matchOption(text, name) {
    var _a, _b;
    return (_b = (_a = text.match(new RegExp(`${name}\\s*:\\s*([^,}\\n]+)`))) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.trim();
}
function cleanOption(value) {
    return value === null || value === void 0 ? void 0 : value.replace(/^['"`]|['"`]$/g, '');
}
function getColumnDecorator(node) {
    return ['PrimaryGeneratedColumn', 'CreateDateColumn', 'UpdateDateColumn', 'Column'].find((name) => hasDecorator(node, name));
}
function hasDecorator(node, name) {
    return getDecorators(node).some((decorator) => {
        const expression = decorator.expression;
        return ts.isCallExpression(expression)
            ? expression.expression.getText() === name
            : expression.getText() === name;
    });
}
function getDecoratorText(node, name, sourceFile) {
    const decorator = getDecorators(node).find((candidate) => {
        const expression = candidate.expression;
        return ts.isCallExpression(expression)
            ? expression.expression.getText(sourceFile) === name
            : expression.getText(sourceFile) === name;
    });
    return (decorator === null || decorator === void 0 ? void 0 : decorator.getText(sourceFile)) || '';
}
function getDecorators(node) {
    return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}
function visit(node, callback) {
    callback(node);
    ts.forEachChild(node, (child) => visit(child, callback));
}
function isStringField(field) {
    return field.type === 'string' || ['varchar', 'text', 'char'].includes(field.columnType || '');
}
function isNumberField(field) {
    return (field.type === 'number' ||
        ['int', 'integer', 'tinyint', 'smallint', 'bigint', 'decimal', 'float', 'double'].includes(field.columnType || ''));
}
function isBooleanField(field) {
    return field.type === 'boolean' || field.columnType === 'boolean';
}
function isDateField(field) {
    return field.type === 'Date' || ['date', 'datetime', 'timestamp'].includes(field.columnType || '');
}
function isSecretField(field) {
    return ['password', 'token', 'secret'].some((part) => field.name.toLowerCase().includes(part));
}
function inputType(field) {
    if (isNumberField(field))
        return 'number';
    if (isDateField(field))
        return 'datetime-local';
    if (field.name.toLowerCase().includes('email'))
        return 'email';
    if (field.name.toLowerCase().includes('password'))
        return 'password';
    return 'text';
}
function camelize(value) {
    return schematics_1.strings.camelize(value);
}
function titleize(value) {
    return schematics_1.strings.classify(schematics_1.strings.dasherize(value)).replace(/([a-z])([A-Z])/g, '$1 $2');
}
function snakeCase(value) {
    return schematics_1.strings.dasherize(value).replace(/-/g, '_');
}
//# sourceMappingURL=index.js.map