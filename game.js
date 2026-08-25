// ============================================
// RIDGE RUNNER VALLEY - COMPLETE GAME ENGINE
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas setup
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// ============================================
// GAME STATE & CONFIG
// ============================================

const STAGES = [
    { name: '🌿 Green Valley', difficulty: 1, terrain: 'grass', color: '#228B22' },
    { name: '🏔️ Rocky Canyon', difficulty: 2, terrain: 'rock', color: '#8B7355' },
    { name: '🏜️ Desert Ridge', difficulty: 3, terrain: 'sand', color: '#DAA520' },
    { name: '❄️ Frozen Peaks', difficulty: 4, terrain: 'ice', color: '#B0E0E6' },
    { name: '🌙 Moon Crater', difficulty: 5, terrain: 'moon', color: '#C0C0C0' },
    { name: '🌋 Volcanic Trail', difficulty: 6, terrain: 'lava', color: '#FF4500' }
];

const VEHICLES = [
    { id: 0, name: '🚙 Trail Buggy', speed: 5, acceleration: 0.15, grip: 0.8, fuel: 100, weight: 1 },
    { id: 1, name: '🚙 Mountain Pickup', speed: 4, acceleration: 0.12, grip: 0.9, fuel: 120, weight: 1.3 },
    { id: 2, name: '🏎️ Rally Beetle', speed: 6, acceleration: 0.2, grip: 0.7, fuel: 80, weight: 0.8 },
    { id: 3, name: '🚚 Heavy Hauler', speed: 3, acceleration: 0.1, grip: 0.95, fuel: 150, weight: 1.5 },
    { id: 4, name: '✈️ Sky Hopper', speed: 5, acceleration: 0.18, grip: 0.6, fuel: 90, weight: 0.9 }
];

let gameState = {
    mode: 'menu', // menu, playing, paused, gameOver
    currentStage: 0,
    currentVehicle: 0,
    coins: 0,
    bestDistance: 0,
    distance: 0,
    score: 0,
    fuel: 100,
    isInAir: false,
    gameOverReason: 'Flipped Over!'
};

let input = {
    accelerate: false,
    brake: false,
    rotateUp: false,
    rotateDown: false
};

// ============================================
// PHYSICS & VEHICLE
// ============================================

class Vehicle {
    constructor(x, y, vehicleType) {
        const config = VEHICLES[vehicleType];
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.angularVel = 0;
        
        this.width = 40;
        this.height = 25;
        this.maxSpeed = config.speed;
        this.acceleration = config.acceleration;
        this.grip = config.grip;
        this.maxFuel = config.fuel;
        this.currentFuel = config.fuel;
        this.weight = config.weight;
        this.onGround = false;
        
        this.wheels = [
            { x: -12, y: 8 },  // front left
            { x: 12, y: 8 }    // front right
        ];
    }

    update(terrain) {
        // Gravity
        this.vy += 0.4 * this.weight;
        
        // Input
        if (input.accelerate && this.currentFuel > 0) {
            this.vx += this.acceleration;
            this.currentFuel = Math.max(0, this.currentFuel - 0.3);
        }
        
        if (input.brake) {
            this.vx *= 0.95;
        }
        
        // Air rotation
        if (input.rotateUp && this.onGround === false) {
            this.angularVel -= 0.08;
        }
        if (input.rotateDown && this.onGround === false) {
            this.angularVel += 0.08;
        }
        
        this.angularVel *= 0.98;
        this.angle += this.angularVel;
        
        // Speed limit
        this.vx = Math.min(Math.max(this.vx, -this.maxSpeed), this.maxSpeed);
        
        // Collision with terrain
        this.onGround = false;
        for (let i = 0; i < terrain.length - 1; i++) {
            const p1 = terrain[i];
            const p2 = terrain[i + 1];
            
            // Simple collision detection
            if (this.x > p1.x && this.x < p2.x) {
                const terrainY = p1.y + (p2.y - p1.y) * ((this.x - p1.x) / (p2.x - p1.x));
                if (this.y + this.height/2 >= terrainY) {
                    this.y = terrainY - this.height/2;
                    this.onGround = true;
                    this.vy = Math.max(0, this.vy * 0.6);
                    
                    // Adjust angle to terrain
                    const terrainAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    this.angle += (terrainAngle - this.angle) * 0.1;
                }
            }
        }
        
        // Game over if flipped too much
        if (Math.abs(this.angle) > Math.PI * 0.7) {
            return false; // Game over
        }
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        return true;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Vehicle body
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Windows
        ctx.fillStyle = '#00D4FF';
        ctx.fillRect(-this.width/2 + 5, -this.height/2 + 3, 8, 5);
        ctx.fillRect(this.width/2 - 13, -this.height/2 + 3, 8, 5);
        
        // Wheels
        ctx.fillStyle = '#000';
        ctx.fillRect(-15, this.height/2 - 2, 8, 5);
        ctx.fillRect(7, this.height/2 - 2, 8, 5);
        
        ctx.restore();
    }
}

// ============================================
// TERRAIN GENERATION
// ============================================

function generateTerrain(stage, seed = 0) {
    const terrain = [];
    const stageConfig = STAGES[stage];
    let y = canvas.height * 0.6;
    let slope = 0;
    
    for (let x = 0; x < canvas.width * 3; x += 30) {
        // Procedural generation based on stage
        const difficulty = stageConfig.difficulty;
        const variation = Math.sin(x * 0.01 + seed) * 20 * difficulty;
        const trend = Math.sin(x * 0.002) * 30;
        
        y += (variation + trend) * 0.5;
        y = Math.max(100, Math.min(canvas.height - 50, y));
        
        terrain.push({ x, y });
    }
    
    return terrain;
}

// ============================================
// COINS & PICKUPS
// ============================================

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.collected = false;
        this.rotation = 0;
    }

    update() {
        this.rotation += 0.05;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    checkCollision(vehicle) {
        const dist = Math.hypot(this.x - vehicle.x, this.y - vehicle.y);
        return dist < 25;
    }
}

class Fuel {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.collected = false;
    }

    draw(ctx) {
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(this.x - 8, this.y - 8, 16, 16);
        ctx.fillStyle = '#00DD00';
        ctx.fillRect(this.x - 5, this.y - 5, 10, 10);
    }

    checkCollision(vehicle) {
        const dist = Math.hypot(this.x - vehicle.x, this.y - vehicle.y);
        return dist < 25;
    }
}

// ============================================
// GAME LOGIC
// ============================================

let terrain = [];
let vehicle = null;
let coins = [];
let fuels = [];
let camera = { x: 0, y: 0 };

function initGame() {
    terrain = generateTerrain(gameState.currentStage, Math.random() * 1000);
    vehicle = new Vehicle(100, canvas.height * 0.5, gameState.currentVehicle);
    
    coins = [];
    fuels = [];
    
    // Spawn coins along terrain
    for (let i = 50; i < terrain.length; i += Math.floor(20 + Math.random() * 15)) {
        coins.push(new Coin(terrain[i].x, terrain[i].y - 50 - Math.random() * 30));
    }
    
    // Spawn fuels
    for (let i = 30; i < terrain.length; i += Math.floor(60 + Math.random() * 40)) {
        fuels.push(new Fuel(terrain[i].x, terrain[i].y - 60 - Math.random() * 20));
    }
    
    gameState.distance = 0;
    gameState.score = 0;
    gameState.mode = 'playing';
}

function updateGame() {
    if (gameState.mode !== 'playing') return;
    
    if (!vehicle.update(terrain)) {
        gameState.mode = 'gameOver';
        gameState.gameOverReason = 'Flipped Over!';
        return;
    }
    
    // Update distance
    if (vehicle.vx > 0) {
        gameState.distance += vehicle.vx * 0.1;
    }
    
    // Check coin collisions
    coins.forEach(coin => {
        if (!coin.collected && coin.checkCollision(vehicle)) {
            coin.collected = true;
            gameState.coins += 10;
            gameState.score += 10;
        }
        coin.update();
    });
    
    // Check fuel collisions
    fuels.forEach(fuel => {
        if (!fuel.collected && fuel.checkCollision(vehicle)) {
            fuel.collected = true;
            vehicle.currentFuel = Math.min(vehicle.maxFuel, vehicle.currentFuel + 30);
        }
    });
    
    // Game over if fell off terrain
    if (vehicle.y > canvas.height + 100) {
        gameState.mode = 'gameOver';
        gameState.gameOverReason = 'Fell Off!';
    }
    
    // Update camera
    camera.x = vehicle.x - canvas.width * 0.25;
    camera.y = vehicle.y - canvas.height * 0.4;
}

function drawGame() {
    // Clear canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    
    // Draw terrain
    ctx.strokeStyle = STAGES[gameState.currentStage].color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(terrain[0].x, terrain[0].y);
    for (let i = 1; i < terrain.length; i++) {
        ctx.lineTo(terrain[i].x, terrain[i].y);
    }
    ctx.stroke();
    
    // Draw ground
    ctx.fillStyle = STAGES[gameState.currentStage].color;
    ctx.beginPath();
    ctx.moveTo(terrain[0].x, terrain[0].y);
    for (let i = 1; i < terrain.length; i++) {
        ctx.lineTo(terrain[i].x, terrain[i].y);
    }
    ctx.lineTo(terrain[terrain.length - 1].x, canvas.height);
    ctx.lineTo(terrain[0].x, canvas.height);
    ctx.fill();
    
    // Draw coins
    coins.forEach(coin => {
        if (!coin.collected) {
            coin.draw(ctx);
        }
    });
    
    // Draw fuels
    fuels.forEach(fuel => {
        if (!fuel.collected) {
            fuel.draw(ctx);
        }
    });
    
    // Draw vehicle
    if (vehicle) {
        vehicle.draw(ctx);
    }
    
    ctx.restore();
}

// ============================================
// UI UPDATES
// ============================================

function updateHUD() {
    document.getElementById('distanceDisplay').textContent = Math.floor(gameState.distance);
    document.getElementById('coinsDisplay').textContent = gameState.coins;
    document.getElementById('stageDisplay').textContent = STAGES[gameState.currentStage].name;
    document.getElementById('fuelBar').style.width = (vehicle ? (vehicle.currentFuel / vehicle.maxFuel * 100) : 100) + '%';
}

function showGameOver() {
    document.getElementById('finalDistance').textContent = Math.floor(gameState.distance);
    document.getElementById('finalCoins').textContent = gameState.coins;
    document.getElementById('finalScore').textContent = Math.floor(gameState.score);
    document.getElementById('gameOverTitle').textContent = '🎮 ' + gameState.gameOverReason;
    
    if (gameState.distance > gameState.bestDistance) {
        gameState.bestDistance = gameState.distance;
    }
    
    document.getElementById('gameOverMenu').classList.remove('hidden');
}

// ============================================
// EVENT LISTENERS
// ============================================

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.accelerate = true;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.brake = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.rotateUp = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.rotateDown = true;
    if (e.key === 'p' || e.key === 'P') {
        if (gameState.mode === 'playing') {
            gameState.mode = 'paused';
            document.getElementById('pauseMenu').classList.remove('hidden');
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.accelerate = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.brake = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.rotateUp = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.rotateDown = false;
});

// Mobile touch controls
document.getElementById('mobileAccel')?.addEventListener('touchstart', () => input.accelerate = true);
document.getElementById('mobileAccel')?.addEventListener('touchend', () => input.accelerate = false);
document.getElementById('mobileBrake')?.addEventListener('touchstart', () => input.brake = true);
document.getElementById('mobileBrake')?.addEventListener('touchend', () => input.brake = false);

// Menu buttons
document.getElementById('playBtn').addEventListener('click', () => {
    document.getElementById('mainMenu').classList.remove('active');
    document.getElementById('gameHUD').classList.remove('hidden');
    initGame();
});

document.getElementById('pauseBtn')?.addEventListener('click', () => {
    if (gameState.mode === 'playing') {
        gameState.mode = 'paused';
        document.getElementById('pauseMenu').classList.remove('hidden');
    }
});

document.getElementById('resumeBtn').addEventListener('click', () => {
    gameState.mode = 'playing';
    document.getElementById('pauseMenu').classList.add('hidden');
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('pauseMenu').classList.add('hidden');
    initGame();
});

document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('gameHUD').classList.add('hidden');
    document.getElementById('mainMenu').classList.add('active');
    gameState.mode = 'menu';
    document.getElementById('menuCoins').textContent = gameState.coins;
    document.getElementById('menuBestDistance').textContent = Math.floor(gameState.bestDistance);
});

document.getElementById('gameOverRestartBtn').addEventListener('click', () => {
    document.getElementById('gameOverMenu').classList.add('hidden');
    initGame();
});

document.getElementById('gameOverMenuBtn').addEventListener('click', () => {
    document.getElementById('gameOverMenu').classList.add('hidden');
    document.getElementById('gameHUD').classList.add('hidden');
    document.getElementById('mainMenu').classList.add('active');
    gameState.mode = 'menu';
    document.getElementById('menuCoins').textContent = gameState.coins;
    document.getElementById('menuBestDistance').textContent = Math.floor(gameState.bestDistance);
});

// ============================================
// GAME LOOP
// ============================================

function gameLoop() {
    updateGame();
    drawGame();
    updateHUD();
    
    if (gameState.mode === 'gameOver') {
        showGameOver();
        gameState.mode = 'menu'; // Prevent multiple triggers
    }
    
    requestAnimationFrame(gameLoop);
}

gameLoop();