class Task {
    constructor(id, description, difficulty, scope) {
        this.id = id;
        this.description = description;
        this.difficulty = Number(difficulty);
        this.scope = scope; // 'global' (grupo) ou 'personal' (individual)
        this.isCompleted = false;
    }

    complete() {
        if (this.isCompleted) return null;
        this.isCompleted = true;
        
        return {
            xpCalculated: this.difficulty * 40,
            goldCalculated: this.difficulty * 15,
            scope: this.scope
        };
    }
}

class StreakTracker {
    constructor(storageKey, dailyXpGoal) {
        this.storageKey = storageKey;
        this.dailyXpGoal = dailyXpGoal;
        this.state = this._loadState();
    }

    _loadState() {
        const fallback = { currentStreak: 0, todayXpProgress: 0, lastActiveDateStr: "", shieldsCount: 0 };
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : fallback;
        } catch {
            return fallback;
        }
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    }

    addProgress(xpAmount) {
        const todayStr = new Date().toISOString().split('T')[0];
        this._evaluateDateTransition(todayStr);

        this.state.todayXpProgress += xpAmount;

        if (this.state.todayXpProgress >= this.dailyXpGoal && this.state.lastActiveDateStr !== todayStr) {
            this.state.currentStreak++;
            this.state.lastActiveDateStr = todayStr;
        }
        this.save();
    }

    _evaluateDateTransition(todayStr) {
        if (!this.state.lastActiveDateStr) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (this.state.lastActiveDateStr !== todayStr && this.state.lastActiveDateStr !== yesterdayStr) {
            if (this.state.shieldsCount > 0) {
                this.state.shieldsCount--;
                this.state.lastActiveDateStr = yesterdayStr;
            } else {
                this.state.currentStreak = 0;
            }
            this.state.todayXpProgress = 0;
        }
    }

    purchaseShield(goldCost, currentGold) {
        if (currentGold < goldCost) return { success: false, msg: "Falta ouro!" };
        this.state.shieldsCount++;
        this.save();
        return { success: true, remainingGold: currentGold - goldCost };
    }

    isGoalAchievedToday() {
        return this.state.lastActiveDateStr === new Date().toISOString().split('T')[0];
    }
}

class GameEngine {
    constructor(config) {
        this.playerName = config.name;
        this.avatar = config.avatar;
        this.shirtColor = config.shirtColor;
        this.farmType = config.farmType;
        this.favoriteThing = config.favoriteThing;
        
        this.xp = 0;
        this.level = 1;
        this.gold = 0;
        this.tasks = [];
        
        this.groupStreak = new StreakTracker("stardew_group_streak", 200);
        this.individualStreak = new StreakTracker("stardew_individual_streak", 100);
        this.taskIdCounter = 1;
    }

    addNewTask(description, difficulty, scope) {
        const cleanDesc = description.trim();
        if (!cleanDesc) return false;

        const task = new Task(this.taskIdCounter++, cleanDesc, difficulty, scope);
        this.tasks.push(task);
        return true;
    }

    processTaskCompletion(id) {
        const targetTask = this.tasks.find(t => t.id === id);
        if (!targetTask) return;

        const rewards = targetTask.complete();
        if (!rewards) return;

        this.gold += rewards.goldCalculated;
        this.xp += rewards.xpCalculated;
        
        if (rewards.scope === 'global') {
            this.groupStreak.addProgress(rewards.xpCalculated);
        } else {
            this.individualStreak.addProgress(rewards.xpCalculated);
        }
        this._checkLevelUp();
    }

    _checkLevelUp() {
        const xpRequired = this.level * 100;
        if (this.xp >= xpRequired) {
            this.xp -= xpRequired;
            this.level++;
            alert(`🌟 LEVEL UP! O gosto de [${this.favoriteThing}] preenche a sua mente! Nível: ${this.level}`);
        }
    }
}

class ViewController {
    constructor() {
        this.engine = null;
        this.currentTab = 'global'; // 'global' ou 'personal'
        this._cacheElements();
        this._bindEvents();
    }

    _cacheElements() {
        this.dom = {
            setupForm: document.getElementById('character-form'),
            setupScreen: document.getElementById('setup-screen'),
            gameScreen: document.getElementById('game-screen'),
            inputName: document.getElementById('player-name'),
            inputFarm: document.getElementById('farm-type'),
            inputAvatar: document.getElementById('avatar-style'),
            inputColor: document.getElementById('shirt-color'),
            inputFavorite: document.getElementById('favorite-thing'),
            previewIcon: document.getElementById('avatar-preview-icon'),
            previewShirt: document.getElementById('shirt-color-preview'),
            displayFarmName: document.getElementById('display-farm-name'),
            displayAvatar: document.getElementById('display-avatar'),
            displayShirt: document.getElementById('display-shirt'),
            displayPlayerName: document.getElementById('display-player-name'),
            displayLevel: document.getElementById('display-level'),
            displayGold: document.getElementById('display-gold'),
            displayXpText: document.getElementById('display-xp-text'),
            xpProgressBar: document.getElementById('xp-progress-bar'),
            
            // Abas
            tabGroup: document.getElementById('tab-group'),
            tabIndividual: document.getElementById('tab-individual'),
            contentGroup: document.getElementById('content-group'),
            contentIndividual: document.getElementById('content-individual'),
            bulletinTitle: document.getElementById('bulletin-title'),
            
            // Contadores UI
            groupStreakDays: document.getElementById('display-group-streak'),
            groupProgress: document.getElementById('display-group-progress'),
            groupFire: document.getElementById('streak-group-fire'),
            indivStreakDays: document.getElementById('display-individual-streak'),
            indivProgress: document.getElementById('display-individual-progress'),
            indivFire: document.getElementById('streak-individual-fire'),
            
            btnBuyGroupShield: document.getElementById('btn-buy-group-shield'),
            btnBuyIndivShield: document.getElementById('btn-buy-individual-shield'),
            inputNewTaskDesc: document.getElementById('new-task-desc'),
            selectNewTaskDiff: document.getElementById('new-task-difficulty'),
            btnAddTask: document.getElementById('btn-add-task'),
            tasksContainer: document.getElementById('tasks-container')
        };
    }

    _bindEvents() {
        this.dom.inputAvatar.addEventListener('change', () => this._updateAvatarPreview());
        this.dom.inputColor.addEventListener('change', () => this._updateAvatarPreview());
        this.dom.setupForm.addEventListener('submit', () => this._handleGameStart());
        this.dom.btnAddTask.addEventListener('click', () => this._handleAddTask());
        
        this.dom.tabGroup.addEventListener('click', () => this._switchTab('global'));
        this.dom.tabIndividual.addEventListener('click', () => this._switchTab('personal'));
        
        this.dom.btnBuyGroupShield.addEventListener('click', () => this._handleShieldPurchase(this.engine.groupStreak));
        this.dom.btnBuyIndivShield.addEventListener('click', () => this._handleShieldPurchase(this.engine.individualStreak));
    }

    _updateAvatarPreview() {
        this.dom.previewIcon.innerText = this.dom.inputAvatar.value;
        this.dom.previewShirt.style.backgroundColor = this.dom.inputColor.value;
    }

    _handleGameStart() {
        const config = {
            name: this.dom.inputName.value,
            avatar: this.dom.inputAvatar.value,
            shirtColor: this.dom.inputColor.value,
            farmType: this.dom.inputFarm.value,
            favoriteThing: this.dom.inputFavorite.value
        };

        this.engine = new GameEngine(config);
        
        // Carga inicial respeitando os escopos do desafio solicitado
        this.engine.addNewTask("Cumprir o treino do grupo (Strava Sync)", 3, "global");
        this.engine.addNewTask("Beber água (2 Litros)", 1, "personal");

        this.dom.setupScreen.classList.add('hidden');
        this.dom.gameScreen.classList.remove('hidden');
        
        this.render();
    }

    _switchTab(targetScope) {
        this.currentTab = targetScope;
        if (targetScope === 'global') {
            this.dom.tabGroup.classList.add('active');
            this.dom.tabIndividual.classList.remove('active');
            this.dom.contentGroup.classList.remove('hidden');
            this.dom.contentIndividual.classList.add('hidden');
            this.dom.bulletinTitle.innerText = "📋 Quadro de Avisos (Grupo)";
        } else {
            this.dom.tabGroup.classList.remove('active');
            this.dom.tabIndividual.classList.add('active');
            this.dom.contentGroup.classList.add('hidden');
            this.dom.contentIndividual.classList.remove('hidden');
            this.dom.bulletinTitle.innerText = "📋 Quadro de Avisos (Individual)";
        }
        this.render();
    }

    _handleAddTask() {
        const desc = this.dom.inputNewTaskDesc.value;
        const diff = this.dom.selectNewTaskDiff.value;
        
        const success = this.engine.addNewTask(desc, diff, this.currentTab);
        if (success) {
            this.dom.inputNewTaskDesc.value = "";
            this.render();
        }
    }

    _handleShieldPurchase(trackerInstance) {
        const SHIELD_COST = 50;
        const purchase = trackerInstance.purchaseShield(SHIELD_COST, this.engine.gold);
        
        if (purchase.success) {
            this.engine.gold = purchase.remainingGold;
            this.render();
        } else {
            alert(purchase.msg);
        }
    }

    render() {
        if (!this.engine) return;

        this.dom.displayFarmName.innerText = `Fazenda ${this.engine.farmType.substring(3)}`;
        this.dom.displayAvatar.innerText = this.engine.avatar;
        this.dom.displayShirt.style.backgroundColor = this.engine.shirtColor;
        this.dom.displayPlayerName.innerText = this.engine.playerName;
        this.dom.displayLevel.innerText = this.engine.level;
        this.dom.displayGold.innerText = this.engine.gold;

        const nextLevelTarget = this.engine.level * 100;
        this.dom.xpProgressBar.style.width = `${Math.min(100, (this.engine.xp / nextLevelTarget) * 100)}%`;
        this.dom.displayXpText.innerText = `${this.engine.xp}/${nextLevelTarget}`;

        // Render da Ofensiva do Grupo
        const gState = this.engine.groupStreak.state;
        this.dom.groupStreakDays.innerText = gState.currentStreak;
        this.dom.groupProgress.innerText = `${gState.todayXpProgress}/${this.engine.groupStreak.dailyXpGoal}`;
        this.dom.groupFire.classList.toggle('active', this.engine.groupStreak.isGoalAchievedToday());

        // Render da Ofensiva Individual
        const iState = this.engine.individualStreak.state;
        this.dom.indivStreakDays.innerText = iState.currentStreak;
        this.dom.indivProgress.innerText = `${iState.todayXpProgress}/${this.engine.individualStreak.dailyXpGoal}`;
        this.dom.indivFire.classList.toggle('active', this.engine.individualStreak.isGoalAchievedToday());

        // Filtro dinâmico do quadro baseado na aba selecionada
        this.dom.tasksContainer.innerHTML = "";
        const filteredTasks = this.engine.tasks.filter(t => t.scope === this.currentTab);
        
        filteredTasks.forEach(task => {
            const item = this._createTaskHtmlNode(task);
            this.dom.tasksContainer.appendChild(item);
        });
    }

    _createTaskHtmlNode(task) {
        const itemDiv = document.createElement('div');
        itemDiv.className = `task-item ${task.isCompleted ? 'completed' : ''}`;
        const labels = ["Leve", "Regular", "Desafio"];
        
        itemDiv.innerHTML = `
            <div>
                <span class="task-text">📌 ${task.description}</span>
                <span class="badge">[${labels[task.difficulty - 1]}]</span>
            </div>
        `;

        const actionButton = document.createElement('button');
        actionButton.className = "pixel-button";
        actionButton.disabled = task.isCompleted;
        actionButton.innerText = task.isCompleted ? "Feito" : "Cumprir";
        
        actionButton.addEventListener('click', () => {
            this.engine.processTaskCompletion(task.id);
            this.render();
        });

        itemDiv.appendChild(actionButton);
        return itemDiv;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ViewController();
});
