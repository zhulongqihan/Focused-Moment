<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

  type Todo = {
    id: string;
    title: string;
    done: boolean;
    createdAt: number;
    priority?: 'low' | 'medium' | 'high';
  };

  let todos: Todo[] = [];
  let newTodoTitle = '';
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  const appWindow = getCurrentWebviewWindow();

  onMount(() => {
    loadTodos();
  });

  async function loadTodos() {
    try {
      const state = await invoke('load_app_state');
      if (state) {
        const data = JSON.parse(state as string);
        todos = data.todos || [];
      }
    } catch (e) {
      console.error('Failed to load todos:', e);
    }
  }

  async function saveTodos() {
    try {
      const state = await invoke('load_app_state');
      const data = state ? JSON.parse(state as string) : {};
      data.todos = todos;
      await invoke('save_app_state', { payload: JSON.stringify(data) });
    } catch (e) {
      console.error('Failed to save todos:', e);
    }
  }

  function addTodo() {
    if (!newTodoTitle.trim()) return;
    
    const newTodo: Todo = {
      id: Date.now().toString(),
      title: newTodoTitle.trim(),
      done: false,
      createdAt: Date.now(),
      priority: 'medium'
    };
    
    todos = [newTodo, ...todos];
    newTodoTitle = '';
    saveTodos();
  }

  function toggleTodo(id: string) {
    todos = todos.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    );
    saveTodos();
  }

  function deleteTodo(id: string) {
    todos = todos.filter(todo => todo.id !== id);
    saveTodos();
  }

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragOffset = {
      x: e.clientX,
      y: e.clientY
    };
  }

  async function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragOffset.x;
    const deltaY = e.clientY - dragOffset.y;
    
    const position = await appWindow.outerPosition();
    await appWindow.setPosition({
      x: position.x + deltaX,
      y: position.y + deltaY
    });
  }

  function handleMouseUp() {
    isDragging = false;
  }

  $: activeTodos = todos.filter(t => !t.done);
  $: completedTodos = todos.filter(t => t.done);
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div class="todo-widget ark-card originium-texture ark-scrollbar">
  <!-- 装饰角 -->
  <div class="ornament-corner ornament-top-left"></div>
  <div class="ornament-corner ornament-top-right"></div>
  <div class="ornament-corner ornament-bottom-left"></div>
  <div class="ornament-corner ornament-bottom-right"></div>

  <!-- 拖拽区域 -->
  <div class="drag-handle" on:mousedown={handleMouseDown}>
    <span class="ark-title">待办清单</span>
    <span class="ark-badge">{activeTodos.length}/{todos.length}</span>
  </div>

  <div class="ark-divider"></div>

  <!-- 添加待办 -->
  <div class="add-todo">
    <input
      type="text"
      class="todo-input"
      placeholder="添加新任务..."
      bind:value={newTodoTitle}
      on:keydown={(e) => e.key === 'Enter' && addTodo()}
    />
    <button class="ark-button" on:click={addTodo}>+</button>
  </div>

  <!-- 待办列表 -->
  <div class="todo-list">
    {#if activeTodos.length === 0 && completedTodos.length === 0}
      <div class="empty-state">
        <p>暂无任务</p>
        <p class="hint">添加你的第一个任务吧</p>
      </div>
    {:else}
      <!-- 进行中的任务 -->
      {#if activeTodos.length > 0}
        <div class="todo-section">
          <h3 class="section-title">进行中</h3>
          {#each activeTodos as todo (todo.id)}
            <div class="todo-item operator-frame">
              <input
                type="checkbox"
                checked={todo.done}
                on:change={() => toggleTodo(todo.id)}
              />
              <span class="todo-title">{todo.title}</span>
              <button class="delete-btn" on:click={() => deleteTodo(todo.id)}>×</button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- 已完成的任务 -->
      {#if completedTodos.length > 0}
        <div class="todo-section">
          <h3 class="section-title">已完成</h3>
          {#each completedTodos as todo (todo.id)}
            <div class="todo-item operator-frame completed">
              <input
                type="checkbox"
                checked={todo.done}
                on:change={() => toggleTodo(todo.id)}
              />
              <span class="todo-title">{todo.title}</span>
              <button class="delete-btn" on:click={() => deleteTodo(todo.id)}>×</button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  @import '$lib/styles/arknights-theme.css';

  .todo-widget {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: rgba(26, 26, 26, 0.95);
    backdrop-filter: blur(10px);
    overflow-y: auto;
    position: fixed;
    z-index: 1000;
  }

  .drag-handle {
    cursor: move;
    padding: 8px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
  }

  .add-todo {
    display: flex;
    gap: 8px;
    margin: 12px 0;
  }

  .todo-input {
    flex: 1;
    background: rgba(0, 152, 220, 0.1);
    border: 1px solid var(--ark-border);
    color: var(--ark-text-primary);
    padding: 8px 12px;
    font-size: 14px;
    outline: none;
    transition: all 0.3s ease;
  }

  .todo-input:focus {
    background: rgba(0, 152, 220, 0.2);
    box-shadow: 0 0 10px rgba(0, 152, 220, 0.3);
  }

  .todo-input::placeholder {
    color: var(--ark-text-muted);
  }

  .ark-button {
    padding: 8px 16px;
    font-size: 18px;
    line-height: 1;
  }

  .todo-list {
    flex: 1;
    overflow-y: auto;
  }

  .todo-section {
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 12px;
    color: var(--ark-accent);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 8px;
    font-weight: bold;
  }

  .todo-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    margin-bottom: 8px;
    background: rgba(0, 152, 220, 0.05);
    transition: all 0.3s ease;
  }

  .todo-item:hover {
    background: rgba(0, 152, 220, 0.1);
    transform: translateX(4px);
  }

  .todo-item.completed {
    opacity: 0.6;
  }

  .todo-item.completed .todo-title {
    text-decoration: line-through;
    color: var(--ark-text-muted);
  }

  .todo-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--ark-primary);
  }

  .todo-title {
    flex: 1;
    color: var(--ark-text-primary);
    font-size: 14px;
  }

  .delete-btn {
    background: none;
    border: none;
    color: var(--ark-text-muted);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .delete-btn:hover {
    color: #ff4444;
    transform: scale(1.2);
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--ark-text-muted);
  }

  .empty-state p {
    margin: 8px 0;
  }

  .hint {
    font-size: 12px;
    opacity: 0.7;
  }
</style>
