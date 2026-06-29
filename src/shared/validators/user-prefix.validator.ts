import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ name: 'UserPrefix', async: false })
export class UserPrefixValidator implements ValidatorConstraintInterface {
  validate(
    value: string,
    validationArguments?: ValidationArguments,
  ): Promise<boolean> | boolean {
    if (validationArguments) {
      const constraints = validationArguments['constraints'] as string[]
      return value.startsWith(constraints[0])
    }
    return true
  }
  defaultMessage?(validationArguments?: ValidationArguments): string {
    return `${validationArguments?.property} is not start with ${validationArguments?.constraints[0]}`
  }
}
