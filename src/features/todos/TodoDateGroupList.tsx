import { For, Show, createMemo, createSignal, type JSX } from "solid-js";
import { ChevronDown } from "lucide-solid";
import type { TodoItem } from "../../lib/contracts";
import type { TodoEditState, TodoSurfaceProps } from "../../lib/theme-contracts";
import { localDateKey, type TodoDateGroup } from "./todo-groups";

type TodoCardProps = Pick<
  TodoSurfaceProps,
  | "editingTodo"
  | "busy"
  | "timerHasProgress"
  | "formatTodoDue"
  | "importanceLabel"
  | "onToggle"
  | "onBeginEdit"
  | "onUseForFocus"
  | "onRemove"
  | "onPatch"
  | "onSave"
  | "onCancel"
> & {
  item: TodoItem;
};

function sameTodoItem(left: TodoItem, right: TodoItem) {
  return left.id === right.id
    && left.title === right.title
    && left.isCompleted === right.isCompleted
    && left.scheduledDate === right.scheduledDate
    && left.scheduledTime === right.scheduledTime
    && left.importanceKey === right.importanceKey;
}

function stabilizeTodoDateGroups(nextGroups: TodoDateGroup[], previousGroups: TodoDateGroup[]) {
  const previousByDate = new Map(previousGroups.map((group) => [group.date, group]));
  let unchanged = nextGroups.length === previousGroups.length
    && nextGroups.every((group, index) => previousGroups[index]?.date === group.date);
  const stableGroups = nextGroups.map((group) => {
    const previous = previousByDate.get(group.date);
    if (!previous || previous.label !== group.label || previous.items.length !== group.items.length) {
      unchanged = false;
      return group;
    }

    const previousItemsById = new Map(previous.items.map((item) => [item.id, item]));
    const stableItems = group.items.map((item) => {
      const previousItem = previousItemsById.get(item.id);
      return previousItem && sameTodoItem(previousItem, item) ? previousItem : item;
    });
    const sameGroup = stableItems.every((item, index) => item === previous.items[index]);
    if (sameGroup) return previous;

    unchanged = false;
    return { ...group, items: stableItems };
  });

  return unchanged ? previousGroups : stableGroups;
}

function TodoCard(props: TodoCardProps) {
  const isOverdue = props.item.scheduledDate < localDateKey();

  return (
    <article classList={{ "todo-row": true, "nv-todo-card": true, "todo-row--overdue": isOverdue }}>
      <Show
        when={props.editingTodo()?.id === props.item.id}
        fallback={
          <>
            <button
              type="button"
              class="todo-check nv-todo-check"
              title="标记完成"
              aria-label={`标记“${props.item.title}”完成`}
              disabled={props.busy()}
              onClick={() => props.onToggle(props.item.id)}
            />
            <div class="nv-todo-card__copy">
              <strong title={props.item.title}>{props.item.title}</strong>
              <small>{props.formatTodoDue(props.item)} · {props.importanceLabel(props.item.importanceKey)}<Show when={isOverdue}><span class="todo-row__overdue-label">已过期</span></Show></small>
            </div>
            <div class="todo-row__actions nv-todo-card__actions">
              <button type="button" class="row-action" disabled={props.busy()} onClick={() => props.onBeginEdit(props.item)}>编辑</button>
              <button type="button" class="row-action" disabled={props.busy() || props.timerHasProgress()} onClick={() => props.onUseForFocus(props.item)}>专注</button>
              <button type="button" class="row-action row-action--danger" disabled={props.busy()} onClick={() => props.onRemove(props.item.id)}>删除</button>
            </div>
          </>
        }
      >
        <div class="todo-edit-form nv-todo-edit-form">
          <label><span>待办事项</span><input type="text" name={`editTodoTitle-${props.item.id}`} autocomplete="off" value={props.editingTodo()?.title ?? ""} onInput={(event) => props.onPatch({ title: event.currentTarget.value })} /></label>
          <label><span>截止日期</span><input type="date" name={`editTodoDate-${props.item.id}`} autocomplete="off" value={props.editingTodo()?.scheduledDate ?? ""} onChange={(event) => props.onPatch({ scheduledDate: event.currentTarget.value })} /></label>
          <label><span>时间</span><input type="time" name={`editTodoTime-${props.item.id}`} autocomplete="off" value={props.editingTodo()?.scheduledTime ?? ""} onInput={(event) => props.onPatch({ scheduledTime: event.currentTarget.value })} /></label>
          <label><span>重要程度</span><select name={`editTodoImportance-${props.item.id}`} value={props.editingTodo()?.importanceKey ?? "medium"} onChange={(event) => props.onPatch({ importanceKey: event.currentTarget.value as TodoEditState["importanceKey"] })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
          <div class="todo-edit-form__actions"><button type="button" class="primary-button" disabled={props.busy()} onClick={props.onSave}>保存</button><button type="button" class="text-button" disabled={props.busy()} onClick={props.onCancel}>取消</button></div>
        </div>
      </Show>
    </article>
  );
}

interface TodoDateGroupListProps extends Omit<TodoCardProps, "item"> {
  groups: () => TodoDateGroup[];
  listLabel: string;
  renderItem?: (item: TodoItem) => JSX.Element;
}

export function TodoDateGroupList(props: TodoDateGroupListProps) {
  const [requestedOpenDate, setRequestedOpenDate] = createSignal<string | null | undefined>(undefined);
  let previousGroups: TodoDateGroup[] = [];
  const stableGroups = createMemo(() => {
    const nextGroups = props.groups();
    const nextStableGroups = stabilizeTodoDateGroups(nextGroups, previousGroups);
    previousGroups = nextStableGroups;
    return nextStableGroups;
  });
  const openDate = createMemo(() => {
    const requested = requestedOpenDate();
    const groups = stableGroups();
    if (requested === null) return null;
    if (requested && groups.some((group) => group.date === requested)) return requested;
    return groups[0]?.date ?? null;
  });

  const toggleDate = (date: string) => {
    setRequestedOpenDate(date === openDate() ? null : date);
  };

  return (
    <div class="nv-todo-date-groups" aria-label={props.listLabel}>
      <For each={stableGroups()}>
        {(group) => {
          const isOpen = () => openDate() === group.date;
          const groupId = `todo-date-group-${group.date.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          return (
            <section classList={{ "nv-todo-date-group": true, "is-expanded": isOpen() }}>
              <button
                type="button"
                class="nv-todo-date-group__toggle"
                aria-expanded={isOpen()}
                aria-controls={groupId}
                onClick={() => toggleDate(group.date)}
              >
                <span class="nv-todo-date-group__label">
                  <strong>{group.label}</strong>
                  <small>{group.items.length} 项待办</small>
                </span>
                <span class="nv-todo-date-group__state">
                  {isOpen() ? "收起" : "展开"}
                  <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
                </span>
              </button>
              <Show when={isOpen()}>
                <div id={groupId} class="nv-todo-date-group__items">
                  <For each={group.items}>
                    {(item) => props.renderItem ? props.renderItem(item) : (
                      <TodoCard
                        item={item}
                        editingTodo={props.editingTodo}
                        busy={props.busy}
                        timerHasProgress={props.timerHasProgress}
                        formatTodoDue={props.formatTodoDue}
                        importanceLabel={props.importanceLabel}
                        onToggle={props.onToggle}
                        onBeginEdit={props.onBeginEdit}
                        onUseForFocus={props.onUseForFocus}
                        onRemove={props.onRemove}
                        onPatch={props.onPatch}
                        onSave={props.onSave}
                        onCancel={props.onCancel}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </section>
          );
        }}
      </For>
    </div>
  );
}
