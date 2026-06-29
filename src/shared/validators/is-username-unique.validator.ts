import { InjectRepository } from '@nestjs/typeorm'
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'
import { User } from '../entities/user.entity'
import { Repository } from 'typeorm'

@ValidatorConstraint({ name: 'IsUserAlreadyExist', async: true })
export class IsUserAlreadyExistConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}
  async validate(value: string): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ username: value })
    return !user
  }
  defaultMessage?(validationArguments?: ValidationArguments): string {
    return `${validationArguments?.property}[${validationArguments?.value}] is existed!`
  }
}

export function IsUserAlreadyExist(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUserAlreadyExistConstraint,
    })
  }
}
