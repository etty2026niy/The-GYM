const taskDetails = document.querySelector('.taskDetails');
const taskDetailContent = document.querySelector('.taskDetailContent');
const deleteConfirmation = document.querySelector('.delete-confirmation');
const deleteTaskName = document.querySelector('.deleteTaskName');
const form = document.querySelector('form');
const taskList = document.querySelector('.taskList');
const taskData = new WeakMap();
const statusFilter = document.getElementById('filterStatus');
const taskSearch = document.getElementById('searchTask');
const sortTasks = document.getElementById('sortTasks');
const noTasksMessage = document.querySelector('.noTasksMessage');
let savedTasks = JSON.parse(localStorage.getItem('tasks')) || [];
let editingTaskElement = null;
let editingTask = null;
let selectedTaskElement = null;
let pendingDeleteTaskElement = null;

function updateTaskPriorityClass(taskElement, task) {
    taskElement.classList.remove(
        'priority-high',
        'priority-medium',
        'priority-low'
    );

    const priority = (task.priority || 'low').toLowerCase();
    const priorityClass = {
        high: 'priority-high',
        medium: 'priority-medium',
        low: 'priority-low'
    }[priority] || 'priority-low';

    taskElement.classList.add(priorityClass);
}

taskList.querySelectorAll('.task').forEach(taskElement => {
    const task = {
        name: taskElement.querySelector('h3').textContent,
        description: taskElement.dataset.description,
        dueDate: taskElement.dataset.dueDate,
        dueTime: taskElement.dataset.dueTime,
        priority: taskElement.dataset.priority,
        status: taskElement.dataset.status
    };
    taskData.set(taskElement, task);
    updateTaskPriorityClass(taskElement, task);
});

const initialTasks = Array.from(taskList.querySelectorAll('.task'));
if (localStorage.getItem('initialTasksMigrated') !== 'true') {
    initialTasks.forEach(taskElement => {
        const task = taskData.get(taskElement);
        const alreadySaved = savedTasks.some(savedTask =>
            savedTask.name === task.name &&
            savedTask.description === task.description &&
            savedTask.dueDate === task.dueDate &&
            savedTask.dueTime === task.dueTime
        );
        if (!alreadySaved) {
            savedTasks.push(task);
        }
    });
    localStorage.setItem('tasks', JSON.stringify(savedTasks));
    localStorage.setItem('initialTasksMigrated', 'true');
}
initialTasks.forEach(taskElement => taskElement.remove());

function getTaskStatus(task) {
    if ((task.status || '').toLowerCase() === 'completed') {
        return 'Completed';
    }

    if (task.dueDate) {
        const dueTime = task.dueTime || '23:59:59';
        const dueTimestamp = new Date(`${task.dueDate}T${dueTime}`).getTime();
        if (!Number.isNaN(dueTimestamp) && dueTimestamp <= Date.now()) {
            return 'Overdue';
        }
    }

    return task.status || 'In Progress';
}

function updateTaskStatusDisplay(taskElement, task) {
    const completed = (task.status || '').toLowerCase() === 'completed';
    const statusElement = taskElement.querySelector('.taskStatus');
    const doneButton = taskElement.querySelector('.done-btn');

    if (statusElement) {
        statusElement.textContent = `Status: ${getTaskStatus(task)}`;
    }
    if (doneButton) {
        doneButton.disabled = completed;
        doneButton.title = completed ? 'Task Completed' : 'Mark as Completed';
        doneButton.setAttribute(
            'aria-label',
            completed ? 'Task Completed' : 'Mark as Completed'
        );
    }
}

function deleteTask(taskElement) {
    const task = taskData.get(taskElement);
    if (!task) {
        return;
    }

    savedTasks = savedTasks.filter(savedTask => savedTask !== task);
    localStorage.setItem('tasks', JSON.stringify(savedTasks));

    if (selectedTaskElement === taskElement) {
        selectedTaskElement = null;
        taskDetails.style.display = 'none';
        taskDetailContent.replaceChildren();
    }
    if (editingTaskElement === taskElement) {
        editingTaskElement = null;
        editingTask = null;
        form.reset();
        form.style.display = 'none';
        form.querySelector('h2').textContent = 'Add New Task';
        form.querySelector('[type="submit"]').textContent = 'Add Task';
    }

    taskElement.remove();
    applyTaskFilters();
}

function requestTaskDeletion(taskElement) {
    pendingDeleteTaskElement = taskElement;
    deleteTaskName.textContent = taskElement.querySelector('h3').textContent;
    deleteConfirmation.showModal();
}

document.querySelector('.cancelDelete').addEventListener('click', () => {
    pendingDeleteTaskElement = null;
    deleteConfirmation.close();
});

deleteConfirmation.addEventListener('cancel', () => {
    pendingDeleteTaskElement = null;
});

document.querySelector('.confirmDelete').addEventListener('click', () => {
    if (pendingDeleteTaskElement) {
        deleteTask(pendingDeleteTaskElement);
    }
    pendingDeleteTaskElement = null;
    deleteConfirmation.close();
});

taskList.querySelectorAll('.task').forEach(taskElement => {
    updateTaskStatusDisplay(taskElement, taskData.get(taskElement));
});

function applyTaskFilters() {
    const selectedStatus = statusFilter.value;
    const searchTerm = taskSearch.value.trim().toLowerCase();
    let visibleTaskCount = 0;

    taskList.querySelectorAll('.task').forEach(taskElement => {
        const task = taskData.get(taskElement);
        if (!task) {
            return;
        }

        const matchesSearch = `${task.name} ${task.description || ''}`
            .toLowerCase()
            .includes(searchTerm);
        const currentStatus = getTaskStatus(task).toLowerCase();
        const matchesStatus =
            selectedStatus === 'all' ||
            (selectedStatus === 'todo' &&
                ['pending', 'to do', 'todo'].includes(currentStatus)) ||
            (selectedStatus === 'in-progress' &&
                ['in progress', 'overdue'].includes(currentStatus)) ||
            (selectedStatus === 'completed' && currentStatus === 'completed');
        const isVisible = matchesSearch && matchesStatus;

        taskElement.hidden = !isVisible;
        if (isVisible) {
            visibleTaskCount += 1;
        }
    });

    noTasksMessage.hidden = visibleTaskCount > 0;
}

function sortTaskCards() {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const taskElements = Array.from(taskList.querySelectorAll('.task'));
    const sortedTasks = taskElements
        .map((element, originalIndex) => ({
            element,
            originalIndex,
            task: taskData.get(element)
        }))
        .sort((first, second) => {
            const { task: firstTask } = first;
            const { task: secondTask } = second;

            if (sortTasks.value === 'name') {
                return firstTask.name.localeCompare(secondTask.name, undefined, {
                    sensitivity: 'base',
                    numeric: true
                }) || first.originalIndex - second.originalIndex;
            }

            if (sortTasks.value === 'priority') {
                const firstPriority = priorityOrder[firstTask.priority] ?? 3;
                const secondPriority = priorityOrder[secondTask.priority] ?? 3;
                return firstPriority - secondPriority ||
                    first.originalIndex - second.originalIndex;
            }

            const getDueTimestamp = task => {
                if (!task.dueDate) {
                    return Number.POSITIVE_INFINITY;
                }

                const timestamp = new Date(
                    `${task.dueDate}T${task.dueTime || '23:59:59'}`
                ).getTime();
                return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
            };

            return getDueTimestamp(firstTask) - getDueTimestamp(secondTask) ||
                first.originalIndex - second.originalIndex;
        });

    sortedTasks.forEach(({ element }) => taskList.appendChild(element));
}

statusFilter.addEventListener('change', applyTaskFilters);
taskSearch.addEventListener('input', applyTaskFilters);
sortTasks.addEventListener('change', sortTaskCards);

function showTaskDetails(task) {
    taskDetailContent.replaceChildren();

    [
        ['Task Name', task.name],
        ['Description', task.description],
        ['Due Date', task.dueDate],
        ['Due Time', task.dueTime],
        ['Status', getTaskStatus(task)],
        ['Priority', task.priority]
    ].forEach(([label, value]) => {
        const paragraph = document.createElement('p');
        if (label === 'Status') {
            paragraph.classList.add('task-detail-status');
        }
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        paragraph.append(strong, document.createTextNode(value || 'Not provided'));
        taskDetailContent.appendChild(paragraph);
    });
}

function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.classList.add('task');
    taskData.set(taskElement, task);
    updateTaskPriorityClass(taskElement, task);

    const heading = document.createElement('h3');
    heading.textContent = task.name;
    taskElement.appendChild(heading);

    taskElement.insertAdjacentHTML('beforeend', `
        <div id="taskActions">
            <div class="countdown" aria-live="polite"></div>
            <p class="taskStatus" style="font-size: 14px; font-style: italic;"></p>
            <div class="taskActions">
                <button class="edit-btn" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="delete-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
                <button class="done-btn" title="Mark as Completed"><i class="fa-solid fa-check"></i></button>
            </div>
        </div>
    `);
    updateTaskStatusDisplay(taskElement, task);

    return taskElement;
}

// Delegate clicks so tasks added after page load receive the same behavior.
taskList.addEventListener('click', (event) => {
    const taskElement = event.target.closest('.task');
    if (!taskElement || !taskList.contains(taskElement)) {
        return;
    }

    if (event.target.closest('.delete-btn')) {
        requestTaskDeletion(taskElement);
        return;
    }

    if (event.target.closest('.edit-btn')) {
        editingTaskElement = taskElement;
        editingTask = taskData.get(taskElement);
        if (!editingTask) {
            return;
        }

        document.getElementById('taskName').value = editingTask.name || '';
        document.getElementById('taskDescription').value = editingTask.description || '';
        document.getElementById('dueDate').value = editingTask.dueDate || '';
        document.getElementById('dueTime').value = editingTask.dueTime || '';
        document.getElementById('priority').value = editingTask.priority || 'low';
        form.querySelector('h2').textContent = 'Edit Task';
        form.querySelector('[type="submit"]').textContent = 'Save Changes';
        form.style.display = 'flex';
        taskDetails.style.display = 'none';
        return;
    }

    if (event.target.closest('.done-btn')) {
        const task = taskData.get(taskElement);
        if (!task) {
            return;
        }

        task.status = 'Completed';
        if (!savedTasks.includes(task)) {
            savedTasks.push(task);
        }
        localStorage.setItem('tasks', JSON.stringify(savedTasks));
        updateTaskStatusDisplay(taskElement, task);
        showTaskDetails(task);
        selectedTaskElement = taskElement;
        taskDetails.style.display = 'flex';
        applyTaskFilters();
        return;
    }

    taskList.querySelectorAll('.task').forEach(task => {
        task.style.backgroundColor = 'rgb(161, 201, 236)';
    });
    taskElement.style.backgroundColor = 'lightgray';
    selectedTaskElement = taskElement;
    taskDetails.style.display = 'flex';
    form.style.display = 'none';

    const task = taskData.get(taskElement);
    if (task) {
        showTaskDetails(task);
    }
});

// displaying form when user clicks on add new task button
const addTaskButton = document.querySelector('.addTask');
addTaskButton.addEventListener('click', () => {
    editingTaskElement = null;
    editingTask = null;
    form.reset();
    form.querySelector('h2').textContent = 'Add New Task';
    form.querySelector('[type="submit"]').textContent = 'Add Task';
    form.style.display = 'flex';
    taskDetails.style.display = 'none';
});
//hiding task details when user clicks outside of the task details

document.addEventListener('click', (event) => {
    if (!taskDetails.contains(event.target) && !event.target.closest('.task')) {
        taskDetails.style.display = 'none';
    }
});

// hiding form when user clicks outside of the form
document.addEventListener('click', (event) => {
    if (
        !form.contains(event.target) &&
        !event.target.classList.contains('addTask') &&
        !event.target.closest('.edit-btn')
    ) {
        form.style.display = 'none';
    }
});

// Saving user input to local storage when the form is submitted
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const taskName = document.getElementById('taskName').value;
    const taskDescription = document.getElementById('taskDescription').value;
    const taskPriority = document.getElementById('priority').value;
    const taskDueDate = document.getElementById('dueDate').value;
    const taskDueTime = document.getElementById('dueTime').value;

    if (editingTask) {
        Object.assign(editingTask, {
            name: taskName,
            description: taskDescription,
            priority: taskPriority,
            dueDate: taskDueDate,
            dueTime: taskDueTime,
            updatedAt: new Date().toISOString()
        });

        if (!savedTasks.includes(editingTask)) {
            savedTasks.push(editingTask);
        }
        taskData.set(editingTaskElement, editingTask);
        updateTaskPriorityClass(editingTaskElement, editingTask);
        editingTaskElement.querySelector('h3').textContent = editingTask.name;
        updateTaskStatusDisplay(editingTaskElement, editingTask);
        showTaskDetails(editingTask);
        taskDetails.style.display = 'flex';
        editingTaskElement.style.backgroundColor = 'lightgray';
        sortTaskCards();
        applyTaskFilters();
    } else {
        const newTask = {
            name: taskName,
            description: taskDescription,
            priority: taskPriority,
            dueDate: taskDueDate,
            dueTime: taskDueTime,
            status: 'Pending',
            savedAt: new Date().toISOString()
        };

        savedTasks.push(newTask);
        taskList.appendChild(createTaskElement(newTask));
        sortTaskCards();
        applyTaskFilters();
    }

    localStorage.setItem('tasks', JSON.stringify(savedTasks));
    editingTaskElement = null;
    editingTask = null;
    form.querySelector('h2').textContent = 'Add New Task';
    form.querySelector('[type="submit"]').textContent = 'Add Task';
    form.reset();
    form.style.display = 'none';
});
console.log(savedTasks);


function updateCountdown(task, element) {
    if (!task.dueDate) {
        element.textContent = 'Due date not set';
        return;
    }

    const dueTime = task.dueTime || '23:59:59';
    const dueDate = new Date(`${task.dueDate}T${dueTime}`).getTime();
    if (Number.isNaN(dueDate)) {
        element.textContent = 'Invalid due date or time';
        return;
    }

    const timeRemaining = dueDate - Date.now();
    if (timeRemaining <= 0) {
        element.textContent = 'Time is up!';
        return;
    }

    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
    const seconds = Math.floor((timeRemaining / 1000) % 60);

    element.textContent =
        `${days} days ${hours} hours ${minutes} min ${seconds} sec remaining`;
}

// retrieving tasks from local storage and displaying them in the task list
savedTasks.forEach(task => {
    taskList.appendChild(createTaskElement(task));
});
sortTaskCards();
applyTaskFilters();

function refreshCountdowns() {
    taskList.querySelectorAll('.task').forEach(taskElement => {
        const task = taskData.get(taskElement);
        const countdown = taskElement.querySelector('.countdown');
        if (task && countdown) {
            updateCountdown(task, countdown);
            updateTaskStatusDisplay(taskElement, task);

            if (taskElement === selectedTaskElement) {
                const detailStatus = taskDetails.querySelector('.task-detail-status');
                if (detailStatus) {
                    detailStatus.lastChild.textContent = ` ${getTaskStatus(task)}`;
                }
            }
        }
    });
}

refreshCountdowns();
setInterval(refreshCountdowns, 1000);
