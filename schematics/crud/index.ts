/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Rule,
  SchematicContext,
  Tree,
  apply,
  applyTemplates,
  chain,
  mergeWith,
  move,
  strings,
  url,
} from '@angular-devkit/schematics'
import * as ts from 'typescript'
import { plural } from 'pluralize'

interface CrudOptions {
  name: string
}

interface EntityField {
  name: string
  columnName: string
  type: string
  columnType?: string
  comment?: string
  nullable: boolean
  hasDefault: boolean
  primary: boolean
  generated: boolean
}

interface EntityMeta {
  className: string
  fields: EntityField[]
  columns: EntityField[]
  displayFields: EntityField[]
  listFields: EntityField[]
}

export function crud(options: CrudOptions): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const entityName = normalizeEntityName(options.name)
    const entityPath = resolveEntityPath(tree, entityName)

    const entity = parseEntity(tree.readText(entityPath), entityPath)
    const templateSource = apply(url('./files'), [
      applyTemplates({
        ...strings,
        entity,
        entityName,
        plural,
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
      move('/'),
    ])

    return chain([
      mergeWith(templateSource),
      updateAdminModule(entityName),
      updateApiModule(entityName),
      updateSharedModule(entityName, entity.className),
      updateDtoIndex(entityName),
      () => {
        context.logger.info(
          `Generated CRUD for ${strings.classify(entityName)}`,
        )
      },
    ])(tree, context)
  }
}

function parseEntity(sourceText: string, entityPath: string): EntityMeta {
  const sourceFile = ts.createSourceFile(
    entityPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  )
  let entityClass: ts.ClassDeclaration | undefined

  visit(sourceFile, (node) => {
    if (ts.isClassDeclaration(node) && hasDecorator(node, 'Entity')) {
      entityClass = node
    }
  })

  if (!entityClass?.name) {
    throw new Error(`No @Entity class found in ${entityPath}`)
  }

  const fields: EntityField[] = []
  for (const member of entityClass.members) {
    if (!ts.isPropertyDeclaration(member) || !member.name) continue
    const decoratorName = getColumnDecorator(member)
    if (!decoratorName) continue

    const name = member.name.getText(sourceFile)
    const decoratorText = getDecoratorText(member, decoratorName, sourceFile)
    const options = parseColumnOptions(decoratorText)
    fields.push({
      name,
      columnName: options.name || snakeCase(name),
      type: member.type?.getText(sourceFile) || 'string',
      columnType: options.type,
      comment: options.comment,
      nullable: options.nullable,
      hasDefault: options.hasDefault,
      primary: decoratorName === 'PrimaryGeneratedColumn',
      generated:
        decoratorName === 'PrimaryGeneratedColumn' ||
        decoratorName === 'CreateDateColumn' ||
        decoratorName === 'UpdateDateColumn',
    })
  }

  const columns = fields.filter((field) => !field.generated)
  return {
    className: entityClass.name.text,
    fields,
    columns,
    displayFields: fields.filter((field) => !isSecretField(field)),
    listFields: columns.filter((field) => !isSecretField(field)).slice(0, 5),
  }
}

function updateAdminModule(entityName: string): Rule {
  return updateFile('/src/admin/admin.module.ts', (content) => {
    const className = `${strings.classify(entityName)}Controller`
    return addImport(
      addArrayItem(content, 'controllers', className),
      className,
      `./controllers/${entityName}.controller`,
    )
  })
}

function updateApiModule(entityName: string): Rule {
  return updateFile('/src/api/api.module.ts', (content) => {
    const className = `${strings.classify(entityName)}Controller`
    return addImport(
      addArrayItem(content, 'controllers', className),
      className,
      `./controller/${entityName}.controller`,
    )
  })
}

function updateSharedModule(entityName: string, entityClassName: string): Rule {
  return updateFile('/src/shared/shared.module.ts', (content) => {
    const serviceName = `${strings.classify(entityName)}Service`
    let next = addImport(
      content,
      serviceName,
      `./services/${entityName}.service`,
    )
    next = addImport(next, entityClassName, `./entities/${entityName}.entity`)
    next = addTypeOrmFeature(next, entityClassName)
    next = addArrayItem(next, 'providers', serviceName)
    next = addArrayItem(next, 'exports', serviceName)
    return next
  })
}

function updateDtoIndex(entityName: string): Rule {
  return updateFile('/src/api/dto/index.ts', (content) => {
    let next = addExport(content, `./${entityName}/${entityName}-create.dto`)
    next = addExport(next, `./${entityName}/${entityName}-update.dto`)
    return next
  })
}

function normalizeEntityName(name: string): string {
  return strings.dasherize(name)
}

function resolveEntityPath(tree: Tree, entityName: string): string {
  const candidates = [
    entityName,
    strings.dasherize(strings.camelize(entityName)),
    strings.dasherize(strings.classify(entityName)),
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .map((value) => `/src/shared/entities/${value}.entity.ts`)

  const entityPath = candidates.find((candidate) => tree.exists(candidate))
  if (!entityPath) {
    throw new Error(`Entity not found. Tried: ${candidates.join(', ')}`)
  }
  return entityPath
}

function updateFile(
  filePath: string,
  updater: (content: string) => string,
): Rule {
  return (tree: Tree) => {
    if (!tree.exists(filePath)) return tree
    const content = tree.readText(filePath)
    const next = updater(content)
    if (next !== content) tree.overwrite(filePath, next)
    return tree
  }
}

function renderCreateDtoImports(entity: EntityMeta): string {
  return collectDtoImports(entity.columns)
}

function renderQueryDtoImports(entity: EntityMeta): string {
  return collectQueryImports(
    entity.columns.filter((field) => !isSecretField(field)),
  )
}

function renderCreateDtoFields(entity: EntityMeta): string {
  return entity.columns.map(renderDtoField).join('\n\n')
}

function renderQueryDtoFields(entity: EntityMeta): string {
  return entity.columns
    .filter((field) => !isSecretField(field))
    .map(renderQueryField)
    .join('\n\n')
}

function renderQueryInputs(entityName: string, entity: EntityMeta): string {
  return entity.listFields
    .slice(0, 4)
    .map((field) => renderQueryInput(entityName, field))
    .join('\n')
}

function renderTableHeaders(entityName: string, entity: EntityMeta): string {
  return entity.listFields
    .map((field) => `      <th>${fieldLabel(entityName, field)}</th>`)
    .join('\n')
}

function renderTableCells(entity: EntityMeta): string {
  return entity.listFields
    .map((field) => `        <td>${fieldValue(field)}</td>`)
    .join('\n')
}

function renderFormInputs(entityName: string, entity: EntityMeta): string {
  return entity.columns
    .filter((field) => !field.primary)
    .map((field) => renderFormInput(entityName, field))
    .join('\n')
}

function renderDetailRows(entityName: string, entity: EntityMeta): string {
  const variableName = camelize(entityName)
  return entity.displayFields
    .map(
      (field) => `    <tr>
      <th class='table-light text-nowrap'>${fieldLabel(entityName, field)}</th>
      <td>${detailValue(entityName, variableName, field)}</td>
    </tr>`,
    )
    .join('\n')
}

function renderI18nJson(
  entityName: string,
  entity: EntityMeta,
  useComments: boolean,
): string {
  const labels: Record<string, string> = {}
  for (const field of entity.displayFields) {
    labels[field.columnName] =
      useComments && field.comment ? field.comment : titleize(field.name)
  }
  return JSON.stringify(
    {
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
    },
    null,
    2,
  )
}

function renderStatusToggleScript(
  entityName: string,
  entity: EntityMeta,
): string {
  if (!hasStatusField(entity)) return ''
  return `    $('.js-status-toggle').on('change', function () {
      var $input = $(this)
      var id = $input.closest('tr').data('id')
      $input.prop('disabled', true)
      $.ajax({
        url: '/admin/${plural(entityName)}' + '/' + id + '/status',
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
`
}

function hasStatusField(entity: EntityMeta): boolean {
  return entity.columns.some((field) => field.name === 'status')
}

function hasDefaultOrder(entity: EntityMeta): boolean {
  return Boolean(defaultOrderField(entity))
}

function defaultOrderField(entity: EntityMeta): string {
  return entity.columns.find((field) => field.name === 'sort')?.name || ''
}

function fuzzyFields(entity: EntityMeta): string {
  return entity.columns
    .filter((field) => isStringField(field) && !isSecretField(field))
    .map((field) => `'${field.name}'`)
    .join(', ')
}

function renderDtoField(field: EntityField): string {
  const optional = field.nullable || field.hasDefault
  const decorators = optional ? ['@IsOptional()'] : []
  if (isNumberField(field)) {
    decorators.push('@Type(() => Number)', '@IsNumber()')
  } else if (isBooleanField(field)) {
    decorators.push('@Type(() => Boolean)', '@IsBoolean()')
  } else if (isDateField(field)) {
    decorators.push('@Type(() => Date)', '@IsDate()')
  } else {
    if (optional) decorators.push('@EmptyStringToUndefined()')
    decorators.push('@IsString()')
  }
  return `${decorators.join('\n')}\n${field.name}${optional ? '?' : '!'}: ${field.type}`
}

function renderQueryField(field: EntityField): string {
  const decorators = ['@IsOptional()']
  if (isNumberField(field)) {
    decorators.push('@Type(() => Number)', '@IsNumber()')
  } else if (isBooleanField(field)) {
    decorators.push(
      '@Transform(({ value }) => {',
      "  if (value === 'true' || value === '1' || value === true) return true",
      "  if (value === 'false' || value === '0' || value === false) return false",
      '  return undefined',
      '})',
      '@IsBoolean()',
    )
  } else if (isDateField(field)) {
    decorators.push('@Type(() => Date)', '@IsDate()')
  } else {
    decorators.push('@EmptyStringToUndefined()', '@IsString()')
  }
  return `${decorators.join('\n')}\n${field.name}?: ${field.type}`
}

function collectDtoImports(fields: EntityField[]): string {
  const validators = new Set<string>()
  let needsType = false
  let needsEmpty = false
  for (const field of fields) {
    if (field.nullable || field.hasDefault) validators.add('IsOptional')
    if (isNumberField(field)) {
      validators.add('IsNumber')
      needsType = true
    } else if (isBooleanField(field)) {
      validators.add('IsBoolean')
      needsType = true
    } else if (isDateField(field)) {
      validators.add('IsDate')
      needsType = true
    } else {
      validators.add('IsString')
      needsEmpty = needsEmpty || field.nullable || field.hasDefault
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
    .join('\n')
}

function collectQueryImports(fields: EntityField[]): string {
  const validators = new Set<string>(['IsOptional'])
  let needsType = false
  let needsTransform = false
  let needsEmpty = false
  for (const field of fields) {
    if (isNumberField(field)) {
      validators.add('IsNumber')
      needsType = true
    } else if (isBooleanField(field)) {
      validators.add('IsBoolean')
      needsTransform = true
    } else if (isDateField(field)) {
      validators.add('IsDate')
      needsType = true
    } else {
      validators.add('IsString')
      needsEmpty = true
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
    .join('\n')
}

function renderQueryInput(entityName: string, field: EntityField): string {
  if (field.name === 'status') {
    return `  <div class='d-flex align-items-center field-item'>
    <label class='me-2 text-nowrap' for='status'>${fieldLabel(entityName, field)}</label>
    <select class='form-select' id='status' name='status' aria-label='status'>
      <option value=''>{{t '${entityName}.status.placeholder'}}</option>
      <option value='0' {{#if (eq query.status 0)}}selected{{/if}}>{{t '${entityName}.status.inactive'}}</option>
      <option value='1' {{#if (eq query.status 1)}}selected{{/if}}>{{t '${entityName}.status.active'}}</option>
    </select>
  </div>`
  }
  return `  <div class='d-flex align-items-center field-item'>
    <label class='me-2 text-nowrap' for='${field.name}'>${fieldLabel(entityName, field)}</label>
    <input type='${inputType(field)}' class='form-control' id='${field.name}' name='${field.name}' value='{{query.${field.name}}}' />
  </div>`
}

function renderFormInput(entityName: string, field: EntityField): string {
  const variableName = camelize(entityName)
  if (field.name === 'status') {
    return `  <div class='mb-3'>
    <label for='status' class='form-label'>${fieldLabel(entityName, field)}</label>
    <select class='form-select' id='status' name='status' aria-label='status'>
      <option value=''>{{t '${entityName}.status.placeholder'}}</option>
      <option value='0' {{#if (eq ${variableName}.status 0)}}selected{{/if}}>{{t '${entityName}.status.inactive'}}</option>
      <option value='1' {{#if (eq ${variableName}.status 1)}}selected{{/if}}>{{t '${entityName}.status.active'}}</option>
    </select>
  </div>`
  }
  if (isBooleanField(field)) {
    return `  <div class='mb-3'>
    <label for='${field.name}' class='form-label'>${fieldLabel(entityName, field)}</label>
    <select class='form-select' id='${field.name}' name='${field.name}' aria-label='${field.name}'>
      <option value=''>{{t '${entityName}.status.placeholder'}}</option>
      <option value='true' {{#if ${variableName}.${field.name}}}selected{{/if}}>{{t '${entityName}.boolean.yes'}}</option>
      <option value='false' {{#unless ${variableName}.${field.name}}}selected{{/unless}}>{{t '${entityName}.boolean.no'}}</option>
    </select>
  </div>`
  }
  return `  <div class='mb-3'>
    <label for='${field.name}' class='form-label'>${fieldLabel(entityName, field)}</label>
    <input type='${inputType(field)}' name='${field.name}' class='form-control' id='${field.name}' value='{{${variableName}.${field.name}}}' />
  </div>`
}

function fieldLabel(entityName: string, field: EntityField): string {
  return `{{t '${entityName}.field.${field.columnName}'}}`
}

function fieldLabelKey(field: EntityField): string {
  return field.columnName
}

function fieldValue(field: EntityField): string {
  if (field.name === 'status') {
    return `<div class='form-check form-switch m-0 ps-0 d-flex justify-content-center align-items-center'>
            <input type='checkbox' class='form-check-input m-0 js-status-toggle' role='switch' {{#unless (eq this.status 0)}}checked{{/unless}} />
          </div>`
  }
  if (isDateField(field)) return `{{formatDate this.${field.name}}}`
  return `{{this.${field.name}}}`
}

function detailValue(
  entityName: string,
  variableName: string,
  field: EntityField,
): string {
  if (field.name === 'status') {
    return `{{#if (eq ${variableName}.status 0)}}<span class='badge bg-secondary'>{{t '${entityName}.status.inactive'}}</span>{{else}}<span class='badge bg-success'>{{t '${entityName}.status.active'}}</span>{{/if}}`
  }
  if (isBooleanField(field)) {
    return `{{#if ${variableName}.${field.name}}}{{t '${entityName}.boolean.yes'}}{{else}}{{t '${entityName}.boolean.no'}}{{/if}}`
  }
  if (isDateField(field)) return `{{formatDate ${variableName}.${field.name}}}`
  return `{{${variableName}.${field.name}}}`
}

function addImport(
  content: string,
  identifier: string,
  modulePath: string,
): string {
  if (content.includes(`import { ${identifier} } from '${modulePath}'`))
    return content
  return `import { ${identifier} } from '${modulePath}'\n${content}`
}

function addArrayItem(content: string, property: string, item: string): string {
  if (
    new RegExp(`${property}\\s*:\\s*\\[[^\\]]*\\b${item}\\b`, 's').test(content)
  ) {
    return content
  }
  return content.replace(
    new RegExp(`(${property}\\s*:\\s*\\[)([^\\]]*)(\\])`, 's'),
    (_match, start, body, end) => {
      const trimmed = body.trim()
      return `${start}${trimmed ? `${trimmed}, ${item}` : item}${end}`
    },
  )
}

function addTypeOrmFeature(content: string, item: string): string {
  if (
    new RegExp(
      `TypeOrmModule\\.forFeature\\(\\[[^\\]]*\\b${item}\\b`,
      's',
    ).test(content)
  ) {
    return content
  }
  return content.replace(
    /TypeOrmModule\.forFeature\(\[([^\]]*)\]\)/s,
    (_match, body) => {
      const trimmed = body.trim()
      return `TypeOrmModule.forFeature([${trimmed ? `${trimmed}, ${item}` : item}])`
    },
  )
}

function addExport(content: string, modulePath: string): string {
  const line = `export * from '${modulePath}'`
  if (content.includes(line)) return content
  return `${content.trimEnd()}\n${line}\n`
}

function parseColumnOptions(decoratorText: string) {
  return {
    type: cleanOption(matchOption(decoratorText, 'type')),
    name: cleanOption(matchOption(decoratorText, 'name')),
    comment: cleanOption(matchOption(decoratorText, 'comment')),
    nullable: /nullable\s*:\s*true/.test(decoratorText),
    hasDefault: /default\s*:/.test(decoratorText),
  }
}

function matchOption(text: string, name: string): string | undefined {
  return text.match(new RegExp(`${name}\\s*:\\s*([^,}\\n]+)`))?.[1]?.trim()
}

function cleanOption(value?: string): string | undefined {
  return value?.replace(/^['"`]|['"`]$/g, '')
}

function getColumnDecorator(node: ts.PropertyDeclaration): string | undefined {
  return [
    'PrimaryGeneratedColumn',
    'CreateDateColumn',
    'UpdateDateColumn',
    'Column',
  ].find((name) => hasDecorator(node, name))
}

function hasDecorator(node: ts.Node, name: string): boolean {
  return getDecorators(node).some((decorator) => {
    const expression = decorator.expression
    return ts.isCallExpression(expression)
      ? expression.expression.getText() === name
      : expression.getText() === name
  })
}

function getDecoratorText(
  node: ts.Node,
  name: string,
  sourceFile: ts.SourceFile,
): string {
  const decorator = getDecorators(node).find((candidate) => {
    const expression = candidate.expression
    return ts.isCallExpression(expression)
      ? expression.expression.getText(sourceFile) === name
      : expression.getText(sourceFile) === name
  })
  return decorator?.getText(sourceFile) || ''
}

function getDecorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : []
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
  callback(node)
  ts.forEachChild(node, (child) => visit(child, callback))
}

function isStringField(field: EntityField): boolean {
  return (
    field.type === 'string' ||
    ['varchar', 'text', 'char'].includes(field.columnType || '')
  )
}

function isNumberField(field: EntityField): boolean {
  return (
    field.type === 'number' ||
    [
      'int',
      'integer',
      'tinyint',
      'smallint',
      'bigint',
      'decimal',
      'float',
      'double',
    ].includes(field.columnType || '')
  )
}

function isBooleanField(field: EntityField): boolean {
  return field.type === 'boolean' || field.columnType === 'boolean'
}

function isDateField(field: EntityField): boolean {
  return (
    field.type === 'Date' ||
    ['date', 'datetime', 'timestamp'].includes(field.columnType || '')
  )
}

function isSecretField(field: EntityField): boolean {
  return ['password', 'token', 'secret'].some((part) =>
    field.name.toLowerCase().includes(part),
  )
}

function inputType(field: EntityField): string {
  if (isNumberField(field)) return 'number'
  if (isDateField(field)) return 'datetime-local'
  if (field.name.toLowerCase().includes('email')) return 'email'
  if (field.name.toLowerCase().includes('password')) return 'password'
  return 'text'
}

function camelize(value: string): string {
  return strings.camelize(value)
}

function titleize(value: string): string {
  return strings
    .classify(strings.dasherize(value))
    .replace(/([a-z])([A-Z])/g, '$1 $2')
}

function snakeCase(value: string): string {
  return strings.dasherize(value).replace(/-/g, '_')
}
