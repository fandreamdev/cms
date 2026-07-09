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
  desc: string
}

interface EntityField {
  name: string
  columnName: string
  type: string
  typeIdentifier?: string
  typeImportModulePath?: string
  columnType?: string
  enumType?: string
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
    const entityDesc = options.desc
    const entityPath = resolveEntityPath(tree, entityName)

    const entity = parseEntity(
      tree.readText(entityPath),
      entityPath,
      entityName,
    )
    const templateSource = apply(url('./files'), [
      applyTemplates({
        ...strings,
        entity,
        entityName,
        entityDesc,
        plural,
        camelize,
        titleize,
        fieldLabelKey,
        renderCreateDtoFields,
        renderQueryDtoFields,
        renderCreateDtoImports,
        renderQueryDtoImports,
        renderI18nJson,
        hasDefaultOrder,
        defaultOrderField,
        fuzzyFields,
      }),
      move('/'),
    ])

    return chain([
      mergeWith(templateSource),
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

function parseEntity(
  sourceText: string,
  entityPath: string,
  entityName: string,
): EntityMeta {
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

  const namedImports = collectNamedImports(sourceFile)
  const dtoPath = `/src/api/dto/${entityName}/${entityName}-create.dto.ts`
  const fields: EntityField[] = []
  for (const member of entityClass.members) {
    if (!ts.isPropertyDeclaration(member) || !member.name) continue
    const decoratorName = getColumnDecorator(member)
    if (!decoratorName) continue

    const name = member.name.getText(sourceFile)
    const decoratorCall = getDecoratorCall(member, decoratorName, sourceFile)
    const options = parseColumnOptions(decoratorCall)
    const typeIdentifier = getTypeIdentifier(member.type)
    const typeImportPath = typeIdentifier
      ? namedImports.get(typeIdentifier)
      : undefined
    fields.push({
      name,
      columnName: options.name || snakeCase(name),
      type: member.type?.getText(sourceFile) || 'string',
      typeIdentifier,
      typeImportModulePath: typeImportPath
        ? relativeImportPath(
            dtoPath,
            resolveImportPath(entityPath, typeImportPath),
          )
        : undefined,
      columnType: options.type,
      enumType: options.enumType,
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

function updateApiModule(entityName: string): Rule {
  return updateFile('/src/api/api.module.ts', (content, filePath) => {
    const className = `${strings.classify(entityName)}Controller`
    return addImport(
      addArrayItem(content, filePath, 'controllers', className),
      filePath,
      className,
      `./controller/${entityName}.controller`,
    )
  })
}

function updateSharedModule(entityName: string, entityClassName: string): Rule {
  return updateFile('/src/shared/shared.module.ts', (content, filePath) => {
    const serviceName = `${strings.classify(entityName)}Service`
    let next = addImport(
      content,
      filePath,
      serviceName,
      `./services/${entityName}.service`,
    )
    next = addImport(
      next,
      filePath,
      entityClassName,
      `./entities/${entityName}.entity`,
    )
    next = addTypeOrmFeature(next, filePath, entityClassName)
    next = addArrayItem(next, filePath, 'providers', serviceName)
    next = addArrayItem(next, filePath, 'exports', serviceName)
    return next
  })
}

function updateDtoIndex(entityName: string): Rule {
  return updateFile('/src/api/dto/index.ts', (content, filePath) => {
    let next = addExport(
      content,
      filePath,
      `./${entityName}/${entityName}-create.dto`,
    )
    next = addExport(next, filePath, `./${entityName}/${entityName}-update.dto`)
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
  updater: (content: string, filePath: string) => string,
): Rule {
  return (tree: Tree) => {
    if (!tree.exists(filePath)) return tree
    const content = tree.readText(filePath)
    const next = updater(content, filePath)
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

function renderI18nJson(
  entityName: string,
  entity: EntityMeta,
  useComments: boolean,
  entityDesc: string,
): string {
  console.log(entityName, entityDesc)
  const labels: Record<string, string> = {}
  for (const field of entity.displayFields) {
    labels[field.columnName] =
      useComments && field.comment ? field.comment : titleize(field.name)
  }
  const title = titleize(entityName)
  const messages = useComments
    ? {
        list_title: `${entityDesc}列表`,
        form_title_create: `创建${entityDesc}`,
        form_title_update: `编辑${entityDesc}`,
        detail_title: `${entityDesc}详情`,
        add: `添加${entityDesc}`,
        search: '查询',
        export: '导出',
        view: '查看',
        edit: '编辑',
        delete: '删除',
        back: '返回',
        actions: '操作',
        total: '共',
        page: '第',
        prev: '上一页',
        next: '下一页',
        delete_confirm: '确定要删除这条记录吗？',
        delete_failed: '删除失败',
        status: {
          placeholder: '请选择',
          inactive: '未激活',
          active: '激活',
        },
        boolean: {
          yes: '是',
          no: '否',
        },
      }
    : {
        list_title: `${title} List`,
        form_title_create: `Create ${title}`,
        form_title_update: `Edit ${title}`,
        detail_title: `${title} Detail`,
        add: `Add ${title}`,
        search: 'Search',
        export: 'Export',
        view: 'View',
        edit: 'Edit',
        delete: 'Delete',
        back: 'Back',
        actions: 'Actions',
        total: 'Total',
        page: 'Page',
        prev: 'Prev',
        next: 'Next',
        delete_confirm: 'Delete this record?',
        delete_failed: 'Delete failed',
        status: {
          placeholder: 'Choose...',
          inactive: 'Inactive',
          active: 'Active',
        },
        boolean: {
          yes: 'Yes',
          no: 'No',
        },
      }
  return JSON.stringify(
    {
      ...messages,
      field: labels,
    },
    null,
    2,
  )
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
  if (isEnumField(field)) {
    if (optional) decorators.push('@EmptyStringToUndefined()')
    decorators.push(`@IsEnum(${enumIdentifier(field)})`)
  } else if (isNumberField(field)) {
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
  if (isEnumField(field)) {
    decorators.push(
      '@EmptyStringToUndefined()',
      `@IsEnum(${enumIdentifier(field)})`,
    )
  } else if (isNumberField(field)) {
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
    if (isEnumField(field)) {
      validators.add('IsEnum')
      needsEmpty = needsEmpty || field.nullable || field.hasDefault
    } else if (isNumberField(field)) {
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
    renderFieldTypeImports(fields),
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
    if (isEnumField(field)) {
      validators.add('IsEnum')
      needsEmpty = true
    } else if (isNumberField(field)) {
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
    renderFieldTypeImports(fields),
  ]
    .filter(Boolean)
    .join('\n')
}

function renderFieldTypeImports(fields: EntityField[]): string {
  const imports = new Map<string, Set<string>>()

  for (const field of fields) {
    if (!isEnumField(field)) continue
    if (!field.typeImportModulePath || !field.typeIdentifier) continue

    const identifiers = imports.get(field.typeImportModulePath) || new Set()
    identifiers.add(field.typeIdentifier)
    imports.set(field.typeImportModulePath, identifiers)
  }

  return Array.from(imports.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([modulePath, identifiers]) => {
      const names = Array.from(identifiers).sort().join(', ')
      return `import { ${names} } from '${modulePath}'`
    })
    .join('\n')
}

function enumIdentifier(field: EntityField): string {
  return field.enumType || field.typeIdentifier || field.type
}

function fieldLabelKey(field: EntityField): string {
  return field.columnName
}

function addImport(
  content: string,
  filePath: string,
  identifier: string,
  modulePath: string,
): string {
  const sourceFile = createSourceFile(filePath, content)
  const importDeclarations = sourceFile.statements.filter(
    ts.isImportDeclaration,
  )
  const existingImport = importDeclarations.find(
    (statement) =>
      getImportModulePath(statement, sourceFile) === modulePath &&
      hasNamedImport(statement, identifier),
  )
  if (existingImport) return content

  const importLine = `import { ${identifier} } from '${modulePath}'\n`
  const lastImport = importDeclarations[importDeclarations.length - 1]
  if (!lastImport) return `${importLine}${content}`

  const lastImportEnd = getLineEnd(content, lastImport.end)
  return `${content.slice(0, lastImportEnd)}${importLine}${content.slice(lastImportEnd)}`
}

function addArrayItem(
  content: string,
  filePath: string,
  property: string,
  item: string,
): string {
  const sourceFile = createSourceFile(filePath, content)
  const arrayLiteral = findModuleArrayProperty(sourceFile, property)
  if (!arrayLiteral) return content

  if (
    arrayLiteral.elements.some(
      (element) => element.getText(sourceFile) === item,
    )
  )
    return content

  return insertArrayElement(content, sourceFile, arrayLiteral, item)
}

function addTypeOrmFeature(
  content: string,
  filePath: string,
  item: string,
): string {
  const sourceFile = createSourceFile(filePath, content)
  const arrayLiteral = findTypeOrmFeatureArray(sourceFile)
  if (!arrayLiteral) return content

  if (
    arrayLiteral.elements.some(
      (element) => element.getText(sourceFile) === item,
    )
  )
    return content

  return insertArrayElement(content, sourceFile, arrayLiteral, item)
}

function addExport(
  content: string,
  filePath: string,
  modulePath: string,
): string {
  const sourceFile = createSourceFile(filePath, content)
  const line = `export * from '${modulePath}'`
  const hasExport = sourceFile.statements.some(
    (statement) =>
      ts.isExportDeclaration(statement) &&
      !statement.exportClause &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === modulePath,
  )
  if (hasExport) return content

  return `${content.trimEnd()}\n${line}\n`
}

function createSourceFile(filePath: string, content: string): ts.SourceFile {
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)
}

function collectNamedImports(sourceFile: ts.SourceFile): Map<string, string> {
  const imports = new Map<string, string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const modulePath = getImportModulePath(statement, sourceFile)
    if (!modulePath) continue

    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue

    for (const element of namedBindings.elements) {
      imports.set(element.name.text, modulePath)
    }
  }

  return imports
}

function getImportModulePath(
  statement: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
): string | undefined {
  const moduleSpecifier = statement.moduleSpecifier
  return ts.isStringLiteral(moduleSpecifier)
    ? moduleSpecifier.text
    : moduleSpecifier.getText(sourceFile)
}

function hasNamedImport(
  statement: ts.ImportDeclaration,
  identifier: string,
): boolean {
  const importClause = statement.importClause
  const namedBindings = importClause?.namedBindings
  return Boolean(
    namedBindings &&
    ts.isNamedImports(namedBindings) &&
    namedBindings.elements.some((element) => element.name.text === identifier),
  )
}

function getTypeIdentifier(typeNode?: ts.TypeNode): string | undefined {
  if (!typeNode) return undefined

  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    return typeNode.typeName.text
  }

  if (ts.isArrayTypeNode(typeNode)) {
    return getTypeIdentifier(typeNode.elementType)
  }

  if (ts.isUnionTypeNode(typeNode)) {
    return typeNode.types
      .map((candidate) => getTypeIdentifier(candidate))
      .find(Boolean)
  }

  return undefined
}

function resolveImportPath(fromFilePath: string, modulePath: string): string {
  if (!modulePath.startsWith('.')) return modulePath

  return normalizePath(`${fromFilePath.replace(/\/[^/]+$/, '')}/${modulePath}`)
}

function relativeImportPath(
  fromFilePath: string,
  toModulePath: string,
): string {
  if (!toModulePath.startsWith('/')) return toModulePath

  const fromParts = fromFilePath
    .replace(/\/[^/]+$/, '')
    .split('/')
    .filter(Boolean)
  const toParts = toModulePath.split('/').filter(Boolean)

  while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
    fromParts.shift()
    toParts.shift()
  }

  const relativeParts = [...fromParts.map(() => '..'), ...toParts]
  const relativePath = relativeParts.join('/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function normalizePath(value: string): string {
  const isAbsolute = value.startsWith('/')
  const parts: string[] = []

  for (const part of value.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
      continue
    }
    parts.push(part)
  }

  return `${isAbsolute ? '/' : ''}${parts.join('/')}`
}

function getLineEnd(content: string, position: number): number {
  if (content[position] === '\r' && content[position + 1] === '\n') {
    return position + 2
  }
  if (content[position] === '\n') return position + 1
  return position
}

function findModuleArrayProperty(
  sourceFile: ts.SourceFile,
  propertyName: string,
): ts.ArrayLiteralExpression | undefined {
  let arrayLiteral: ts.ArrayLiteralExpression | undefined
  visit(sourceFile, (node) => {
    if (arrayLiteral || !ts.isDecorator(node)) return
    const expression = node.expression
    if (!ts.isCallExpression(expression)) return
    if (expression.expression.getText(sourceFile) !== 'Module') return
    const moduleOptions = expression.arguments.find(
      ts.isObjectLiteralExpression,
    )
    if (!moduleOptions) return
    const property = findObjectArrayProperty(
      sourceFile,
      moduleOptions,
      propertyName,
    )
    if (property) arrayLiteral = property
  })
  return arrayLiteral
}

function findObjectArrayProperty(
  sourceFile: ts.SourceFile,
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string,
): ts.ArrayLiteralExpression | undefined {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    if (getPropertyName(property.name) !== propertyName) continue
    return ts.isArrayLiteralExpression(property.initializer)
      ? property.initializer
      : undefined
  }
  return undefined
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  if (ts.isNumericLiteral(name)) return name.text
  return undefined
}

function findTypeOrmFeatureArray(
  sourceFile: ts.SourceFile,
): ts.ArrayLiteralExpression | undefined {
  let arrayLiteral: ts.ArrayLiteralExpression | undefined
  visit(sourceFile, (node) => {
    if (arrayLiteral || !ts.isCallExpression(node)) return
    const expression = node.expression
    if (!ts.isPropertyAccessExpression(expression)) return
    if (expression.name.text !== 'forFeature') return
    if (expression.expression.getText(sourceFile) !== 'TypeOrmModule') return
    const firstArgument = node.arguments[0]
    if (firstArgument && ts.isArrayLiteralExpression(firstArgument)) {
      arrayLiteral = firstArgument
    }
  })
  return arrayLiteral
}

function insertArrayElement(
  content: string,
  sourceFile: ts.SourceFile,
  arrayLiteral: ts.ArrayLiteralExpression,
  item: string,
): string {
  if (!arrayLiteral.elements.length) {
    const insertPosition = arrayLiteral.getStart(sourceFile) + 1
    return `${content.slice(0, insertPosition)}${item}${content.slice(insertPosition)}`
  }

  const lastElement = arrayLiteral.elements[arrayLiteral.elements.length - 1]
  const insertPosition = lastElement.end
  return `${content.slice(0, insertPosition)}, ${item}${content.slice(insertPosition)}`
}

function parseColumnOptions(decoratorCall?: ts.CallExpression) {
  const options: {
    type?: string
    name?: string
    enumType?: string
    comment?: string
    nullable: boolean
    hasDefault: boolean
  } = {
    nullable: false,
    hasDefault: false,
  }

  if (!decoratorCall) return options

  for (const argument of decoratorCall.arguments) {
    if (ts.isStringLiteral(argument)) {
      options.type ??= argument.text
      continue
    }
    if (!ts.isObjectLiteralExpression(argument)) continue

    for (const property of argument.properties) {
      if (!ts.isPropertyAssignment(property)) continue
      const propertyName = getPropertyName(property.name)
      if (!propertyName) continue

      if (propertyName === 'default') {
        options.hasDefault = true
        continue
      }

      const value = getLiteralOptionValue(property.initializer)
      if (propertyName === 'type') options.type = value
      if (propertyName === 'name') options.name = value
      if (propertyName === 'enum') options.enumType = value
      if (propertyName === 'comment') options.comment = value
      if (propertyName === 'nullable') options.nullable = value === 'true'
    }
  }

  return options
}

function getLiteralOptionValue(expression: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) {
    return expression.text
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return 'true'
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return 'false'
  if (ts.isIdentifier(expression)) return expression.text
  return undefined
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

function getDecoratorCall(
  node: ts.Node,
  name: string,
  sourceFile: ts.SourceFile,
): ts.CallExpression | undefined {
  const decorator = getDecorators(node).find((candidate) => {
    const expression = candidate.expression
    return ts.isCallExpression(expression)
      ? expression.expression.getText(sourceFile) === name
      : expression.getText(sourceFile) === name
  })
  return decorator && ts.isCallExpression(decorator.expression)
    ? decorator.expression
    : undefined
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

function isEnumField(field: EntityField): boolean {
  return field.columnType === 'enum' || Boolean(field.enumType)
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
