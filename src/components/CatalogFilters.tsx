import { useId } from "react";
import type { DictionaryItem } from "../api/types";
import SiteSelect from "./SiteSelect";

type Props = {
  search: string; cityId: number; categoryId: number;
  cities: DictionaryItem[]; categories: DictionaryItem[];
  onSearch: (value: string) => void; onCity: (id: number) => void;
  onCategory: (id: number) => void; onReset: () => void;
};

export default function CatalogFilters({ search, cityId, categoryId, cities, categories, onSearch, onCity, onCategory, onReset }: Props) {
  const id = useId();
  const active = Number(Boolean(search.trim())) + Number(Boolean(cityId)) + Number(Boolean(categoryId));
  return <section className="catalog-filters" aria-label="Фильтры событий">
    <div className="catalog-filter-fields">
      <label htmlFor={`${id}-search`}>Поиск<input id={`${id}-search`} type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder="Событие или площадка"/></label>
      <div><label htmlFor={`${id}-city`}>Город</label><SiteSelect id={`${id}-city`} value={cityId} onChange={value => onCity(Number(value))} options={[{ value: 0, label: "Все города" }, ...cities.map(city => ({ value: city.id, label: city.name }))]}/></div>
      <div><label htmlFor={`${id}-category`}>Категория</label><SiteSelect id={`${id}-category`} value={categoryId} onChange={value => onCategory(Number(value))} options={[{ value: 0, label: "Все события" }, ...categories.map(category => ({ value: category.id, label: category.name }))]}/></div>
    </div>
    {active > 0 && <div className="catalog-active-filters" aria-label="Активные фильтры">
      {search.trim() && <button type="button" onClick={() => onSearch("")} aria-label="Убрать поисковый запрос">Поиск: {search} ×</button>}
      {cityId > 0 && <button type="button" onClick={() => onCity(0)} aria-label="Убрать фильтр города">{cities.find(city => city.id === cityId)?.name ?? "Город"} ×</button>}
      {categoryId > 0 && <button type="button" onClick={() => onCategory(0)} aria-label="Убрать фильтр категории">{categories.find(category => category.id === categoryId)?.name ?? "Категория"} ×</button>}
      <button type="button" className="catalog-reset" onClick={onReset}>Сбросить все ({active})</button>
    </div>}
  </section>;
}
