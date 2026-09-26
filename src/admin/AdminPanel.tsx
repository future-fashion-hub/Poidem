import { useState } from "react";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import PeopleRounded from "@mui/icons-material/PeopleRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import ReportProblemRounded from "@mui/icons-material/ReportProblemRounded";
import {
  AppBar,
  BooleanField,
  Datagrid,
  DateField,
  DateTimeInput,
  Edit,
  FunctionField,
  Layout,
  List,
  NumberField,
  Resource,
  SearchInput,
  SelectInput,
  SimpleForm,
  TextField,
  TextInput,
  Title,
  TitlePortal,
  useDataProvider,
  useGetList,
  useNotify,
  useRecordContext,
  useRefresh,
  type LayoutProps,
  type RaRecord,
} from "react-admin";
import type { Company, Event, Report, User } from "../api/types";

const userStatus = [{ id: "active", name: "Активен" }, { id: "banned", name: "Заблокирован" }];
const eventStatus = [
  { id: "pending", name: "На модерации" },
  { id: "active", name: "Активно" },
  { id: "rejected", name: "Отклонено" },
  { id: "blocked", name: "Заблокировано" },
  { id: "completed", name: "Завершено" },
];
const reportStatus = [{ id: "pending", name: "Новая" }, { id: "resolved", name: "Решена" }, { id: "rejected", name: "Отклонена" }];
const categories = ["Технологии", "Музыка", "Искусство", "Спорт", "Еда", "Кино"].map((name, index) => ({ id: index + 1, name }));
const cities = ["Москва", "Санкт-Петербург", "Казань", "Екатеринбург"].map((name, index) => ({ id: index + 1, name }));

const userFilters = [<SearchInput key="search" source="q" placeholder="Имя пользователя" alwaysOn />];
const eventFilters = [
  <SearchInput key="search" source="q" placeholder="Название или площадка" alwaysOn />,
  <SelectInput key="status" source="status" label="Статус" choices={eventStatus} />,
];
const reportFilters = [<SelectInput key="status" source="status" label="Статус" choices={reportStatus} alwaysOn />];

const statusColors: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  active: "success", pending: "warning", resolved: "success", rejected: "error", blocked: "error", banned: "error", completed: "info", closed: "default",
};
const statusLabels: Record<string, string> = {
  active: "Активно", pending: "На проверке", resolved: "Решено", rejected: "Отклонено", blocked: "Заблокировано", banned: "Заблокирован", completed: "Завершено", closed: "Закрыто",
};

function StatusChip({ status }: { status: string }) {
  return <Chip size="small" color={statusColors[status] ?? "default"} label={statusLabels[status] ?? status} variant={status === "active" ? "filled" : "outlined"} />;
}

function RowAction({ resource, nextStatus, label, color = "primary", confirmText }: { resource: string; nextStatus: string; label: string; color?: "primary" | "error" | "success"; confirmText?: string }) {
  const record = useRecordContext<RaRecord>();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const [isPending, setIsPending] = useState(false);
  if (!record) return null;
  const run = async () => {
    if (confirmText && !window.confirm(confirmText)) return;
    setIsPending(true);
    try {
      await dataProvider.update(resource, { id: record.id, data: { ...record, status: nextStatus }, previousData: record });
      notify("Изменения сохранены", { type: "success" });
      refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось выполнить действие", { type: "error" });
    } finally {
      setIsPending(false);
    }
  };
  return <Button size="small" color={color} disabled={isPending} onClick={(event) => { event.stopPropagation(); void run(); }}>{label}</Button>;
}

function UserActions() {
  const record = useRecordContext<User>();
  if (!record || record.role === "admin") return <Typography variant="caption" color="text.secondary">Системный</Typography>;
  return record.status === "banned"
    ? <RowAction resource="users" nextStatus="active" label="Разблокировать" color="success" />
    : <RowAction resource="users" nextStatus="banned" label="Заблокировать" color="error" confirmText={`Заблокировать пользователя ${record.firstName}?`} />;
}

function EventActions() {
  const record = useRecordContext<Event>();
  if (!record) return null;
  if (record.status === "pending") return <Stack direction="row"><RowAction resource="events" nextStatus="active" label="Одобрить" color="success" /><RowAction resource="events" nextStatus="rejected" label="Отклонить" color="error" confirmText="Отклонить мероприятие?" /></Stack>;
  if (record.status === "active") return <RowAction resource="events" nextStatus="blocked" label="Заблокировать" color="error" confirmText="Заблокировать мероприятие?" />;
  return <Typography variant="caption" color="text.secondary">Действий нет</Typography>;
}

function CompanyActions() {
  const record = useRecordContext<Company>();
  if (!record || record.status === "blocked") return <Typography variant="caption" color="text.secondary">Заблокирована</Typography>;
  return <RowAction resource="companies" nextStatus="blocked" label="Заблокировать" color="error" confirmText={`Заблокировать компанию «${record.name}»?`} />;
}

function ReportActions() {
  const record = useRecordContext<Report>();
  if (!record || record.status !== "pending") return <Typography variant="caption" color="text.secondary">Обработана</Typography>;
  return <Stack direction="row"><RowAction resource="reports" nextStatus="resolved" label="Решить" color="success" /><RowAction resource="reports" nextStatus="rejected" label="Отклонить" /></Stack>;
}

export function UserList() {
  return <List filters={userFilters} sort={{ field: "createdAt", order: "DESC" }} perPage={25} title="Пользователи" actions={false}>
    <Datagrid bulkActionButtons={false} rowClick={false}>
      <TextField source="id" label="ID" />
      <FunctionField label="Пользователь" render={(record: User) => `${record.firstName} ${record.lastName ?? ""}`} />
      <FunctionField label="Город" render={(record: User) => record.city?.name ?? "—"} />
      <FunctionField label="Роль" render={(record: User) => record.role === "admin" ? "Администратор" : "Пользователь"} />
      <FunctionField label="Статус" render={(record: User) => <StatusChip status={record.status} />} />
      <BooleanField source="isProfileComplete" label="Профиль заполнен" />
      <DateField source="createdAt" label="Регистрация" locales="ru-RU" />
      <FunctionField label="Действия" render={() => <UserActions />} />
    </Datagrid>
  </List>;
}

export function EventList() {
  return <List filters={eventFilters} sort={{ field: "startsAt", order: "ASC" }} perPage={25} title="Мероприятия" actions={false}>
    <Datagrid bulkActionButtons={false} rowClick="edit">
      <TextField source="id" label="ID" />
      <TextField source="title" label="Название" />
      <FunctionField label="Статус" render={(record: Event) => <StatusChip status={record.status} />} />
      <DateField source="startsAt" label="Начало" showTime locales="ru-RU" />
      <NumberField source="participantsCount" label="Участники" />
      <NumberField source="companiesCount" label="Компании" />
      <FunctionField label="Модерация" render={() => <EventActions />} />
    </Datagrid>
  </List>;
}

export function EventEdit() {
  return <Edit title="Редактирование мероприятия" mutationMode="pessimistic">
    <SimpleForm>
      <TextInput source="title" label="Название" fullWidth />
      <TextInput source="description" label="Описание" multiline rows={4} fullWidth />
      <SelectInput source="categoryId" label="Категория" choices={categories} />
      <SelectInput source="cityId" label="Город" choices={cities} />
      <DateTimeInput source="startsAt" label="Начало" />
      <DateTimeInput source="endsAt" label="Окончание" />
      <TextInput source="locationName" label="Площадка" fullWidth />
      <TextInput source="address" label="Адрес" fullWidth />
      <TextInput source="imageUrl" label="Ссылка на изображение" fullWidth />
    </SimpleForm>
  </Edit>;
}

export function CompanyList() {
  return <List sort={{ field: "createdAt", order: "DESC" }} perPage={25} title="Компании" actions={false}>
    <Datagrid bulkActionButtons={false} rowClick={false}>
      <TextField source="id" label="ID" />
      <TextField source="name" label="Название" />
      <NumberField source="eventId" label="ID события" />
      <FunctionField label="Организатор" render={(record: Company) => `${record.owner.firstName} ${record.owner.lastName ?? ""}`} />
      <FunctionField label="Участники" render={(record: Company) => `${record.membersCount}/${record.maxMembers}`} />
      <FunctionField label="Статус" render={(record: Company) => <StatusChip status={record.status} />} />
      <FunctionField label="Действия" render={() => <CompanyActions />} />
    </Datagrid>
  </List>;
}

export function ReportList() {
  return <List filters={reportFilters} sort={{ field: "createdAt", order: "DESC" }} perPage={25} title="Жалобы" actions={false}>
    <Datagrid bulkActionButtons={false} rowClick={false}>
      <TextField source="id" label="ID" />
      <FunctionField label="Объект" render={(record: Report) => `${record.targetType} #${record.targetId}`} />
      <TextField source="reason" label="Причина" />
      <TextField source="description" label="Описание" />
      <FunctionField label="Автор" render={(record: Report) => `${record.author.firstName} ${record.author.lastName ?? ""}`} />
      <FunctionField label="Статус" render={(record: Report) => <StatusChip status={record.status} />} />
      <DateField source="createdAt" label="Создана" showTime locales="ru-RU" />
      <FunctionField label="Действия" render={() => <ReportActions />} />
    </Datagrid>
  </List>;
}

function MetricCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return <Card sx={{ p: 3, borderRadius: 4, boxShadow: "0 10px 35px rgba(20,50,30,.07)", border: "1px solid #e2e9df" }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><Box><Typography color="text.secondary" variant="body2">{title}</Typography><Typography variant="h3" sx={{ mt: 1, fontWeight: 900, letterSpacing: "-.05em" }}>{value}</Typography></Box><Box sx={{ width: 52, height: 52, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: color }}>{icon}</Box></Box>
  </Card>;
}

export function AdminDashboard() {
  const users = useGetList("users", { pagination: { page: 1, perPage: 1 } });
  const events = useGetList("events", { pagination: { page: 1, perPage: 1 }, filter: { status: "active" } });
  const companies = useGetList("companies", { pagination: { page: 1, perPage: 1 } });
  const reports = useGetList("reports", { pagination: { page: 1, perPage: 1 }, filter: { status: "pending" } });
  return <Box sx={{ p: { xs: 2, md: 3 } }}>
    <Title title="Дашборд" />
    <Typography variant="overline" sx={{ color: "#64806a", fontWeight: 800, letterSpacing: ".16em" }}>Пойдём · сегодня</Typography>
    <Typography variant="h4" sx={{ mt: .5, mb: 3, fontWeight: 900, letterSpacing: "-.04em" }}>Состояние платформы</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }, gap: 2 }}>
      <MetricCard title="Пользователей" value={users.total ?? 0} icon={<PeopleRounded />} color="#dff8a1" />
      <MetricCard title="Активных событий" value={events.total ?? 0} icon={<EventRounded />} color="#cdebd5" />
      <MetricCard title="Компаний" value={companies.total ?? 0} icon={<GroupsRounded />} color="#d8e7ff" />
      <MetricCard title="Новых жалоб" value={reports.total ?? 0} icon={<ReportProblemRounded />} color="#ffe0d7" />
    </Box>
    <Card sx={{ mt: 3, p: 3, borderRadius: 4, border: "1px solid #e2e9df", boxShadow: "none" }}><Typography variant="h6" fontWeight={800}>Очередь модерации</Typography><Typography sx={{ mt: 1, color: "text.secondary" }}>Проверьте новые жалобы и события со статусом «На модерации». Все действия в демо сохраняются локально и соответствуют статусам OpenAPI-контракта.</Typography></Card>
  </Box>;
}

function AdminAppBar() {
  return <AppBar color="primary" sx={{ "& .RaAppBar-toolbar": { minHeight: 64 } }}><TitlePortal /><Box sx={{ flex: 1 }} /><Button href="/" color="inherit" sx={{ fontWeight: 700 }}>Открыть сайт</Button></AppBar>;
}

export function AdminLayout(props: LayoutProps) {
  return <Layout
    {...props}
    appBar={AdminAppBar}
    sx={{
      "& .RaLayout-content": {
        paddingTop: { xs: 2, md: 3 },
      },
      "& .RaSidebar-fixed": {
        paddingTop: { xs: 2, md: 3 },
      },
    }}
  />;
}

export const adminResources = <>
  <Resource name="users" list={UserList} icon={PeopleRounded} options={{ label: "Пользователи" }} />
  <Resource name="events" list={EventList} edit={EventEdit} icon={EventRounded} options={{ label: "Мероприятия" }} />
  <Resource name="companies" list={CompanyList} icon={GroupsRounded} options={{ label: "Компании" }} />
  <Resource name="reports" list={ReportList} icon={ReportProblemRounded} options={{ label: "Жалобы" }} />
</>;
