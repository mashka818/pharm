import { AdminDto } from 'src/admins/dto/admin.dto';
import { UpdateCompanyDto } from 'src/companies/dto/update-company.dto';
import { CustomerDto } from 'src/customers/dto/customer.dto';

export type TAllUsers = AdminDto | UpdateCompanyDto | CustomerDto;

export interface IRequestWithUser extends Request {
  user: TAllUsers;
}
