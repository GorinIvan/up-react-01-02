import ProductCard from './ProductCard';

const products = [
  { id: 1, name: 'Блокнот', price: 280, image: '📓' },
  { id: 2, name: 'Карандаши', price: 350, image: '✏️' },
  { id: 3, name: 'Линейка', price: 120, image: '📏' },
];

export default function App() {
  return (
    <main>
      <h1>Карточки товаров</h1>
      <div className="products">
        {products.map((product) => <ProductCard key={product.id} {...product} />)}
      </div>
    </main>
  );
}
