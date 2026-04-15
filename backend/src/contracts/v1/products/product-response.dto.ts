import { ProductDto } from './product.types';

export class ProductResponseDto {
  product!: ProductDto;
}

export class ProductListResponseDto {
  products!: ProductDto[];
}
