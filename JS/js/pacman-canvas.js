/*-------------------------------------------------------------------

	___________    ____   _____ _____    ____  
	\____ \__  \ _/ ___\ /     \\__  \  /    \ 
	|  |_> > __ \\  \___|  Y Y  \/ __ \|   |  \
	|   __(____  /\___  >__|_|  (____  /___|  /
	|__|       \/     \/      \/     \/     \/ .platzh1rsch.ch
	
	author: platzh1rsch		(www.platzh1rsch.ch)
	
-------------------------------------------------------------------*/

"use strict";

  //enumerações globais
  const GHOSTS = {
    AZUL: 'azul',
    VERMELHO: 'vermelho',
    ROSA: 'rosa',
    LARANJA: 'laranja'
  }

// global constants
const FINAL_LEVEL = 10;
const PILL_POINTS = 10;
const POWERPILL_POINTS = 50;
const GHOST_POINTS = 100;
const HIGHSCORE_ENABLED = true;


function geronimo() {
	/* ----- Variáveis ​​globais---------------------------------------- */
	var canvas;
	var context;
	var game;
	var canvas_walls, context_walls;
	var azul, vermelho, laranja, rosa;

	var mapConfig = "data/map.json";


	/* AJAX coisa */
	var getHighscore = () => {
		setTimeout(ajax_get, 30);
	}
	var ajax_get = () => {
		var date = new Date().getTime();
		$.ajax({
			datatype: "json",
			type: "GET",
			url: "data/db-handler.php",
			data: {
				timestamp: date,
				action: "get"
			},
			success: function (msg) {
				$("#highscore-list").text("");
				for (var i = 0; i < msg.length; i++) {
					$("#highscore-list").append("<li>" + msg[i]['name'] + "<span id='score'>" + msg[i]['score'] + "</span></li>");
				}
			}
		});
	}
	var ajax_add = (n, s, l) => {

		$.ajax({
			type: 'POST',
			url: 'data/db-handler.php',
			data: {
				action: 'add',
				name: n,
				score: s,
				level: l
			},
			dataType: 'json',
			success: function (data) {
				console.log('Highscore added: ' + data);
				$('#highscore-form').html('<span class="button" id="show-highscore">View Highscore List</span>');
			},
			error: function (errorThrown) {
				console.log(errorThrown);
			}
		});
	}

	function addHighscore() {
		var name = $("input[type=text]").val();
		$("#highscore-form").html("Saving highscore...");
		ajax_add(name, game.score.score, game.level);
	}

	function buildWall(context, gridX, gridY, width, height) {
		console.log("BuildWall");
		width = width * 2 - 1;
		height = height * 2 - 1;
		context.fillRect(pacman.radius / 2 + gridX * 2 * pacman.radius, pacman.radius / 2 + gridY * 2 * pacman.radius, width * pacman.radius, height * pacman.radius);
	}

	function between(x, min, max) {
		return x >= min && x <= max;
	}

	// Logger
	var logger = function () {
		var originalConsoleLog = null;
		var originalConsoleDebug = null;
		var logger = {};

		logger.enableLogger = function enableLogger() {
			if (originalConsoleLog === null)
				return;

			window['console']['log'] = originalConsoleLog;
			console.log('console.log enabled');

			if (originalConsoleDebug === null)
				return;

			window['console']['debug'] = originalConsoleDebug;
			console.log('console.debug enabled');

		};

		logger.disableLogger = function disableLogger() {
			console.log('console.log disabled');
			originalConsoleLog = console.log;
			window['console']['log'] = function () {};
			originalConsoleDebug = console.debug;
			window['console']['debug'] = function () {};
		};

		return logger;
	}();

	// parar o relógio para medir o tempo
	function Timer() {
		this.time_diff = 0;
		this.time_start = 0;
		this.time_stop = 0;
		this.start = function () {
			this.time_start = new Date().getTime();
		}
		this.stop = function () {
			this.time_stop = new Date().getTime();
			this.time_diff += this.time_stop - this.time_start;
			this.time_stop = 0;
			this.time_start = 0;
		}
		this.reset = function () {
			this.time_diff = 0;
			this.time_start = 0;
			this.time_stop = 0;
		}
		this.get_time_diff = function () {
			return this.time_diff;
		}
	}

	// Gerencia todo o jogo ("God Object")
	function Game() {
		this.timer = new Timer(); // TODO: implementar corretamente e enviar com highscore
		this.refreshRate = 33; // velocidade do jogo, aumentará em níveis mais altos

		this.started = false; // TODO: qual é exatamente o propósito disso?
		this.pause = true;
		this.gameOver = false;

		this.score = new Score();
		this.soundfx = 0;
		this.map;
		this.pillCount; // número de comprimidos
		this.monsters;
		this.level = 1;
		this.refreshLevel = function (h) {
			$(h).html("Lvl: " + this.level);
		};
		this.canvas = $("#myCanvas").get(0);
		this.wallColor = "Blue";
		this.width = this.canvas.width;
		this.height = this.canvas.height;

		// estados globais da pílula
		this.pillSize = 3;
		this.powerpillSizeMin = 2;
		this.powerpillSizeMax = 6;
		this.powerpillSizeCurrent = this.powerpillSizeMax;
		this.powerPillAnimationCounter = 0;

		// TODO: pílulas de energia vibrante
		this.nextPowerPillSize = function () {
			/*if (this.powerPillAnimationCounter === 3) {
				this.powerPillAnimationCounter = 0;
				this.powerpillSizeCurrent = this.powerpillSizeMin + this.powerpillSizeCurrent % (this.powerpillSizeMax-this.powerpillSizeMin);
			} else {
				this.powerPillAnimationCounter++;
			}*/
			return this.powerpillSizeCurrent;
		};

		// estados fantasmas globais
		this.ghostFrightened = false;
		this.ghostFrightenedTimer = 240;
		this.ghostMode = 0; // 0 = Dispersão, 1 = Perseguição
		this.ghostModeTimer = 200; // decrements each animationLoop execution
		this.ghostSpeedNormal = (this.level > 4 ? 3 : 2); 
        // padrão global para fantasma speed
		this.ghostSpeedDazzled = 2; // padrão global para velocidade fantasma quando ofuscado

		/* Funções do jogo */
		this.startGhostFrightened = function () {
			console.log("ghost frigthened");
			this.ghostFrightened = true;
			this.ghostFrightenedTimer = 240;
			azul.dazzle();
			rosa.dazzle();
			vermelho.dazzle();
			laranja.dazzle();
		};

		this.endGhostFrightened = function () {
			this.ghostFrightened = false;
			azul.undazzle();
			rosa.undazzle();
			vermelho.undazzle();
			laranja.undazzle();
		};


		this.checkGhostMode = function () {
			if (this.ghostFrightened) {

				this.ghostFrightenedTimer--;
				if (this.ghostFrightenedTimer === 0) {
					this.endGhostFrightened();
					this.ghostFrigthenedTimer = 240;
					/*inky.reverseDirection();
					pinky.reverseDirection();
					clyde.reverseDirection();
					blinky.reverseDirection();*/
				}
			}
			// sempre decrementa o timer do ghostMode
			this.ghostModeTimer--;
			if (this.ghostModeTimer === 0 && game.level > 1) {
				this.ghostMode ^= 1;
				this.ghostModeTimer = 200 + this.ghostMode * 450;
				console.log("ghostMode=" + this.ghostMode);

				game.buildWalls();

				azul.reverseDirection();
				rosa.reverseDirection();
				laranja.reverseDirection();
				vermelho.reverseDirection();
			}
		};

		this.getMapContent = function (x, y) {
			var maxX = game.width / 30 - 1;
			var maxY = game.height / 30 - 1;
			if (x < 0) x = maxX + x;
			if (x > maxX) x = x - maxX;
			if (y < 0) y = maxY + y;
			if (y > maxY) y = y - maxY;
			return this.map.posY[y].posX[x].type;
		};

		this.setMapContent = function (x, y, val) {
			this.map.posY[y].posX[x].type = val;
		};

		this.toggleSound = function () {
			this.soundfx === 0 ? this.soundfx = 1 : this.soundfx = 0;
			$('#mute').toggle();
		};

		// TODO: teste
		this.reset = function () {
			this.score.set(0);
			this.score.refresh(".score");
			pacman.lives = 3;
			game.level = 1;
			this.refreshLevel(".level");

			this.pause = false;
			this.gameOver = false;
		};

		this.newGame = function () {
			var r = confirm("Are you sure you want to restart?");
			if (r) {
				console.log("new Game");
				this.init(0);
				this.forceResume();
			}
		};

		this.nextLevel = function () {
			console.debug('nextLevel: current, final', this.level, FINAL_LEVEL);
			if (this.level === FINAL_LEVEL) {
				console.log('next level, ' + FINAL_LEVEL + ', end game');
				game.endGame(true);
				game.showHighscoreForm();
			} else {
				this.level++;
				console.log("Level " + game.level);
				game.pauseAndShowMessage("Level " + game.level, this.getLevelTitle() + "<br/>(Click to continue!)");
				game.refreshLevel(".level");
				this.init(1);
			}
		};

		/* UI funções */
		this.drawHearts = function (count) {
			var html = "";
			for (var i = 0; i < count; i++) {
				html += " <img src='img/heart.png'>";
			}
			$(".lives").html("Lives: " + html);

		};

		this.showContent = function (id) {
			$('.content').hide();
			$('#' + id).show();
		};

		this.getLevelTitle = function () {
			switch (this.level) {
				case 2:
					return '"A perseguição começa"';
					// ativa a comutação de perseguição/dispersão
				case 3:
					return '"azul\s despertar"';
					// Inky começa a sair da casa fantasma
				case 4:
					return '"laranja\s despertar"';
					// Clyde começa a sair da casa fantasma
				case 5:
					return '"Necessito de velocidade"';
					// Todos os fantasmas ficam mais rápidos a partir de agora
				case 6:
					return '"época de caça 1"';
					// TODO: Sem humor de dispersão desta vez
				case 7:
					return '"a grande calma"';
					// TODO: Desta vez, apenas disperse o humor
				case 8:
					return '"época de caça 2"';
					// TODO: Sem humor de dispersão e todos os fantasmas saem instantaneamente
				case 9:
					return '"ghosts on speed"';
					// TODO: Fantasmas ficam ainda mais rápidos neste nível
				case FINAL_LEVEL:
					return '"fantasmas em velocidade"';
					// TODO: Fantasmas ficam ainda mais rápidos neste nível
				default:
					return '"nada de novo"';
			}
		}

		this.showMessage = function (title, text) {
			$('#canvas-overlay-container').fadeIn(200);
			if ($('.controls').css('display') != "none") $('.controls').slideToggle(200);
			$('#canvas-overlay-content #title').text(title);
			$('#canvas-overlay-content #text').html(text);
		}

		this.pauseAndShowMessage = function (title, text) {
			this.timer.stop();
			this.pause = true;
			this.showMessage(title, text);
		};

		this.closeMessage = function () {
			$('#canvas-overlay-container').fadeOut(200);
			$('.controls').slideToggle(200);
		};

		this.validateScoreWithLevel = function () {
			const maxLevelPointsPills = 104 * PILL_POINTS;
			const maxLevelPointsPowerpills = 4 * POWERPILL_POINTS;
			const maxLevelPointsGhosts = 4 * 4 * GHOST_POINTS;
			const maxLevelPoints = maxLevelPointsPills + maxLevelPointsPowerpills + maxLevelPointsGhosts;

			const scoreIsValid = this.score.score / this.level <= maxLevelPoints;
			console.log('validate score. score: ' + this.score.score + ', level: ' + this.level, scoreIsValid);
			return scoreIsValid;

		}

		this.showHighscoreForm = function () {
			var scoreIsValid = this.validateScoreWithLevel();

			var inputHTML = scoreIsValid ? `<div id='highscore-form'>
					<span id='form-validator'></span>
					<input type='text' id='playerName'/>
					<span class='button' id='score-submit'>salvar</span>
				</div>` : `<div id='invalid-score'>Sua pontuação parece falsa, a lista de recordes é apenas para jogadores honestos;)</div>`;
			this.pauseAndShowMessage("Game over", "Total Score: " + this.score.score + (HIGHSCORE_ENABLED ? inputHTML : ''));
			$('#playerName').focus();
		}

		/* controles do jogo */

		this.forceStartAnimationLoop = function () {
			// inicia o cronômetro
			this.timer.start();

			this.pause = false;
			this.started = true;
			this.closeMessage();
			animationLoop();
		}

		this.forcePause = function () {
			this.timer.stop();
			this.pauseAndShowMessage("Pause", "Click to Resume");
		}

		this.forceResume = function () {
			this.closeMessage();
			this.pause = false;
			this.timer.start();
		}

		this.pauseResume = function () {
			if (this.gameOver) {
				console.log('Cannot pause / resume. GameOver set to true.');
				return;
			}
			if (!this.started) {
				this.forceStartAnimationLoop();
			} else if (this.pause) {
				this.forceResume();
			} else {
				this.pauseAndShowMessage("Pause", "Click to Resume");
			}
		};

		this.loadMapConfig = async () => {
			console.log('load map config');
			return new Promise((resolve, reject) => {
				$.ajax({
					url: mapConfig,
					beforeSend: function (xhr) {
						if (xhr.overrideMimeType) xhr.overrideMimeType("application/json");
					},
					dataType: "json",
					success: (data) => {
						console.log('map config loaded');
						game.map = data;
						resolve(data);
					},
					error: (response) => {
						console.error('error fetching map config');
						reject(response);
					}
				});
			})
		};

		this.getPillCount = () => {
			var temp = 0;
			$.each(this.map.posY, function (i, item) {
				$.each(this.posX, function () {
					if (this.type == "pill") {
						temp++;
						//console.log("Pill Count++. temp="+temp+". PillCount="+this.pillCount+".");
					}
				});
			});
			return temp;
		}

		this.init = async (state) => {

			console.log("init game " + state);

			// obtém o mapa de nível
			this.map = await this.loadMapConfig();

			this.pillCount = this.getPillCount();

			// TODO: por que existem 2 verificações de estado?
			if (state === 0) {
				this.timer.reset();
				game.reset();
			}
			pacman.reset();

			game.drawHearts(pacman.lives);

			this.ghostFrightened = false;
			this.ghostFrightenedTimer = 240;
			this.ghostMode = 0; // 0 = Dispersão, 1 = Perseguição
			this.ghostModeTimer = 200; 
            // decrementa cada execução do animationLoop

			// decrementa cada execução do animationLoop
			if (rosa === null || rosa === undefined) {
				rosa = new Ghost(GHOSTS.ROSA, 7, 5, 'img/fantasma.rosa.svg', 2, 2);
				azul = new Ghost(GHOSTS.AZUL, 8, 5, 'img/fantasma.azul.svg', 13, 11);
				vermelho = new Ghost(GHOSTS.VERMELHO, 9, 5, 'img/fantasma.vermelho.svg', 13, 0);
				laranja = new Ghost(GHOSTS.LARANJA, 10, 5, 'img/fantasma.laranja.svg', 2, 11);
			} else {
				rosa.reset();
				azul.reset();
				vermelho.reset();
				laranja.reset();
			}
			vermelho.start(); // blinky é o primeiro a sair da ghostHouse
			azul.start();
			rosa.start();
			laranja .start();
		};

		this.checkForLevelUp = function () {
			if ((this.pillCount === 0) && game.started) {
				this.nextLevel();
			}
		};

		this.endGame = function (allLevelsCompleted = false) {
			console.log('Game Over by ' + (allLevelsCompleted ? 'WIN' : 'LOSS'));
			this.pause = true;
			this.gameOver = true;
		}

		this.toPixelPos = function (gridPos) {
			return gridPos * 30;
		};

		this.toGridPos = function (pixelPos) {
			return ((pixelPos % 30) / 30);
		};

		/* ------------ Iniciar paredes pré-construídas  ------------ */
		this.buildWalls = function () {
			if (this.ghostMode === 0) game.wallColor = "Blue";
			else game.wallColor = "Red";
			canvas_walls = document.createElement('canvas');
			canvas_walls.width = game.canvas.width;
			canvas_walls.height = game.canvas.height;
			context_walls = canvas_walls.getContext("2d");

			context_walls.fillStyle = game.wallColor;
			context_walls.strokeStyle = game.wallColor;

			//horizontal exterior
			buildWall(context_walls, 0, 0, 18, 1);
			buildWall(context_walls, 0, 12, 18, 1);

			// vertical exterior
			buildWall(context_walls, 0, 0, 1, 6);
			buildWall(context_walls, 0, 7, 1, 6);
			buildWall(context_walls, 17, 0, 1, 6);
			buildWall(context_walls, 17, 7, 1, 6);

			// base fantasma
			buildWall(context_walls, 7, 4, 1, 1);
			buildWall(context_walls, 6, 5, 1, 2);
			buildWall(context_walls, 10, 4, 1, 1);
			buildWall(context_walls, 11, 5, 1, 2);
			buildWall(context_walls, 6, 6, 6, 1);

			//porta da base fantasma
			context_walls.fillRect(8 * 2 * pacman.radius, pacman.radius / 2 + 4 * 2 * pacman.radius + 5, 4 * pacman.radius, 1);

			// blocos únicos
			buildWall(context_walls, 4, 0, 1, 2);
			buildWall(context_walls, 13, 0, 1, 2);

			buildWall(context_walls, 2, 2, 1, 2);
			buildWall(context_walls, 6, 2, 2, 1);
			buildWall(context_walls, 15, 2, 1, 2);
			buildWall(context_walls, 10, 2, 2, 1);

			buildWall(context_walls, 2, 3, 2, 1);
			buildWall(context_walls, 14, 3, 2, 1);
			buildWall(context_walls, 5, 3, 1, 1);
			buildWall(context_walls, 12, 3, 1, 1);
			buildWall(context_walls, 3, 3, 1, 3);
			buildWall(context_walls, 14, 3, 1, 3);

			buildWall(context_walls, 3, 4, 1, 1);
			buildWall(context_walls, 14, 4, 1, 1);

			buildWall(context_walls, 0, 5, 2, 1);
			buildWall(context_walls, 3, 5, 2, 1);
			buildWall(context_walls, 16, 5, 2, 1);
			buildWall(context_walls, 13, 5, 2, 1);

			buildWall(context_walls, 0, 7, 2, 2);
			buildWall(context_walls, 16, 7, 2, 2);
			buildWall(context_walls, 3, 7, 2, 2);
			buildWall(context_walls, 13, 7, 2, 2);

			buildWall(context_walls, 4, 8, 2, 2);
			buildWall(context_walls, 12, 8, 2, 2);
			buildWall(context_walls, 5, 8, 3, 1);
			buildWall(context_walls, 10, 8, 3, 1);

			buildWall(context_walls, 2, 10, 1, 1);
			buildWall(context_walls, 15, 10, 1, 1);
			buildWall(context_walls, 7, 10, 4, 1);
			buildWall(context_walls, 4, 11, 2, 2);
			buildWall(context_walls, 12, 11, 2, 2);
			/* ------------ Acabar com paredes pré-construídas  ------------ */
		};

	}

	game = new Game();



	function Score() {
		this.score = 0;
		this.set = function (i) {
			this.score = i;
		};
		this.add = function (i) {
			this.score += i;
		};
		this.refresh = function (h) {
			$(h).html("Score: " + this.score);
		};

	}



	// usado para reproduzir sons durante o jogo
	var Sound = {};
	Sound.play = function (sound) {
		if (game.soundfx == 1) {
			var audio = document.getElementById(sound);
			(audio !== null) ? audio.play(): console.log(sound + " not found");
		}
	};


	// Objeto de direção na notação do Construtor
	function Direction(name, angle1, angle2, dirX, dirY) {
		this.name = name;
		this.angle1 = angle1;
		this.angle2 = angle2;
		this.dirX = dirX;
		this.dirY = dirY;
		this.equals = function (dir) {
			return JSON.stringify(this) == JSON.stringify(dir);
		};
	}

	// Direction Objects
	var up = new Direction("up", 1.75, 1.25, 0, -1); // UP
	var left = new Direction("left", 1.25, 0.75, -1, 0); // LEFT
	var down = new Direction("down", 0.75, 0.25, 0, 1); // DOWN
	var right = new Direction("right", 0.25, 1.75, 1, 0); // RIGHT
	/*var directions = [{},{},{},{}];
	directions[0] = up;
	directions[1] = down;
	directions[2] = right;
	directions[3] = left;*/


	// DirectionWatcher
	function directionWatcher() {
		this.dir = null;
		this.set = function (dir) {
			this.dir = dir;
		};
		this.get = function () {
			return this.dir;
		};
	}

	//var directionWatcher = new directionWatcher();

	// Objeto fantasma na notação Constructor
	function Ghost(name, gridPosX, gridPosY, image, gridBaseX, gridBaseY) {
		this.name = name;
		this.posX = gridPosX * 30;
		this.posY = gridPosY * 30;
		this.startPosX = gridPosX * 30;
		this.startPosY = gridPosY * 30;
		this.gridBaseX = gridBaseX;
		this.gridBaseY = gridBaseY;
		this.speed = game.ghostSpeedNormal;
		this.images = JSON.parse(
			'{"normal" : {' +
			`"${GHOSTS.AZUL}" : "0",` +
			`"${GHOSTS.ROSA}" : "1",` +
			`"${GHOSTS.VERMELHO}" : "2",` +
			`"${GHOSTS.LARANJA}" : "3"` +
			'},' +
			'"frightened1" : {' +
			'"left" : "", "up": "", "right" : "", "down": ""},' +
			'"frightened2" : {' +
			'"left" : "", "up": "", "right" : "", "down": ""},' +
			'"dead" : {' +
			'"left" : "", "up": "", "right" : "", "down": ""}}'
		);
		this.image = new Image();
		this.image.src = image;
		this.ghostHouse = true;
		this.dazzled = false;
		this.dead = false;
		this.dazzle = function () {
			this.changeSpeed(game.ghostSpeedDazzled);
			// garante que o fantasma não saia da grade
			if (this.posX > 0) this.posX = this.posX - this.posX % this.speed;
			if (this.posY > 0) this.posY = this.posY - this.posY % this.speed;
			this.dazzled = true;
		}
		this.undazzle = function () {
			// só altera a velocidade se o fantasma não estiver "morto"
			if (!this.dead) this.changeSpeed(game.ghostSpeedNormal);
			// ensure ghost doesnt leave grid
			if (this.posX > 0) this.posX = this.posX - this.posX % this.speed;
			if (this.posY > 0) this.posY = this.posY - this.posY % this.speed;
			this.dazzled = false;
		}
		this.dazzleImg = new Image();
		this.dazzleImg.src = 'img/dazzled.svg';
		this.dazzleImg2 = new Image();
		this.dazzleImg2.src = 'img/dazzled2.svg';
		this.deadImg = new Image();
		this.deadImg.src = 'img/dead.svg';
		this.direction = right;
		this.radius = pacman.radius;
		this.draw = function (context) {
			if (this.dead) {
				context.drawImage(this.deadImg, this.posX, this.posY, 2 * this.radius, 2 * this.radius);
			} else if (this.dazzled) {
				if (pacman.beastModeTimer < 50 && pacman.beastModeTimer % 8 > 1) {
					context.drawImage(this.dazzleImg2, this.posX, this.posY, 2 * this.radius, 2 * this.radius);
				} else {
					context.drawImage(this.dazzleImg, this.posX, this.posY, 2 * this.radius, 2 * this.radius);
				}
			} else context.drawImage(this.image, this.posX, this.posY, 2 * this.radius, 2 * this.radius);
		}
		this.getCenterX = function () {
			return this.posX + this.radius;
		}
		this.getCenterY = function () {
			return this.posY + this.radius;
		}

		this.reset = function () {
			this.dead = false;
			this.posX = this.startPosX;
			this.posY = this.startPosY;
			this.ghostHouse = true;
			this.undazzle();
		}

		this.die = function () {
			if (!this.dead) {
				game.score.add(GHOST_POINTS);
				//this.reset();
				this.dead = true;
				this.changeSpeed(game.ghostSpeedNormal);
			}
		}
		this.changeSpeed = function (s) {
			// ajusta gridPosition para a nova velocidade
			this.posX = Math.round(this.posX / s) * s;
			this.posY = Math.round(this.posY / s) * s;
			this.speed = s;
		}

		this.move = function () {

			this.checkDirectionChange();
			this.checkCollision();

			// sai da Casa Fantasma
			if (this.ghostHouse == true) {

				// Clyde não começa a perseguir antes de 2/3 de todas as pílulas serem consumidas e se o nível for < 4
				if (this.name == GHOSTS.CLYDE) {
					if ((game.level < 4) || ((game.pillCount > 104 / 3))) this.stop = true;
					else this.stop = false;
				}
				// Inky começa após 30 pílulas e somente a partir do terceiro nível
				if (this.name == GHOSTS.INKY) {
					if ((game.level < 3) || ((game.pillCount > 104 - 30))) this.stop = true;
					else this.stop = false;
				}

				if ((this.getGridPosY() == 5) && this.inGrid()) {
					if ((this.getGridPosX() == 7)) this.setDirection(right);
					if ((this.getGridPosX() == 8) || this.getGridPosX() == 9) this.setDirection(up);
					if ((this.getGridPosX() == 10)) this.setDirection(left);
				}
				if ((this.getGridPosY() == 4) && ((this.getGridPosX() == 8) || (this.getGridPosX() == 9)) && this.inGrid()) {
					console.log("ghosthouse -> false");
					this.ghostHouse = false;
				}
			}

			if (!this.stop) {
				// Mover
				this.posX += this.speed * this.dirX;
				this.posY += this.speed * this.dirY;

				// Verifica se está fora da tela
				if (this.posX >= game.width - this.radius) this.posX = this.speed - this.radius;
				if (this.posX <= 0 - this.radius) this.posX = game.width - this.speed - this.radius;
				if (this.posY >= game.height - this.radius) this.posY = this.speed - this.radius;
				if (this.posY <= 0 - this.radius) this.posY = game.height - this.speed - this.radius;
			}
		}

		this.checkCollision = function () {

			/* Verifique Voltar para casa */
			if (this.dead && (this.getGridPosX() == this.startPosX / 30) && (this.getGridPosY() == this.startPosY / 30)) this.reset();
			else {

				/* Verifique a colisão fantasma/pacman			*/
				if ((between(pacman.getCenterX(), this.getCenterX() - 10, this.getCenterX() + 10)) &&
					(between(pacman.getCenterY(), this.getCenterY() - 10, this.getCenterY() + 10))) {
					if ((!this.dazzled) && (!this.dead)) {
						pacman.die();
					} else {
						this.die();
					}
				}
			}
		}

		/* Encontrando o caminho */
		this.getNextDirection = function () {
			// obtém o próximo campo
			var pX = this.getGridPosX();
			var pY = this.getGridPosY();
			game.getMapContent(pX, pY);
			var u, d, r, l; // opção cima, baixo, direita, esquerda

			// obtém o alvo
			if (this.dead) { // ir para casa
				var tX = this.startPosX / 30;
				var tY = this.startPosY / 30;
			} else if (game.ghostMode == 0) { // Modo de dispersão
				var tX = this.gridBaseX;
				var tY = this.gridBaseY;
			} else if (game.ghostMode == 1) { // Modo de Perseguição

				switch (this.name) {

					// alvo: 4 à frente e 4 à esquerda do pacman
					case GHOSTS.PINKY:
						var pdir = pacman.direction;
						var pdirX = pdir.dirX == 0 ? -pdir.dirY : pdir.dirX;
						var pdirY = pdir.dirY == 0 ? -pdir.dirX : pdir.dirY;

						var tX = (pacman.getGridPosX() + pdirX * 4) % (game.width / pacman.radius + 1);
						var tY = (pacman.getGridPosY() + pdirY * 4) % (game.height / pacman.radius + 1);
						break;

						
                    // alvo: pacman
					case GHOSTS.BLINKY:
						var tX = pacman.getGridPosX();
						var tY = pacman.getGridPosY();
						break;

						// target: 
					case GHOSTS.INKY:
						var tX = pacman.getGridPosX() + 2 * pacman.direction.dirX;
						var tY = pacman.getGridPosY() + 2 * pacman.direction.dirY;
						var vX = tX - blinky.getGridPosX();
						var vY = tY - blinky.getGridPosY();
						tX = Math.abs(blinky.getGridPosX() + vX * 2);
						tY = Math.abs(blinky.getGridPosY() + vY * 2);
						break;

						// alvo: pacman, até que pacman esteja mais perto de 5 campos de grade, então volte para dispersão
					case GHOSTS.CLYDE:
						var tX = pacman.getGridPosX();
						var tY = pacman.getGridPosY();
						var dist = Math.sqrt(Math.pow((pX - tX), 2) + Math.pow((pY - tY), 2));

						if (dist < 5) {
							tX = this.gridBaseX;
							tY = this.gridBaseY;
						}
						break;

				}
			}
			var oppDir = this.getOppositeDirection(); // fantasmas não podem mudar de direção 180 

			var dirs = [{}, {}, {}, {}];
			dirs[0].field = game.getMapContent(pX, pY - 1);
			dirs[0].dir = up;
			dirs[0].distance = Math.sqrt(Math.pow((pX - tX), 2) + Math.pow((pY - 1 - tY), 2));

			dirs[1].field = game.getMapContent(pX, pY + 1);
			dirs[1].dir = down;
			dirs[1].distance = Math.sqrt(Math.pow((pX - tX), 2) + Math.pow((pY + 1 - tY), 2));

			dirs[2].field = game.getMapContent(pX + 1, pY);
			dirs[2].dir = right;
			dirs[2].distance = Math.sqrt(Math.pow((pX + 1 - tX), 2) + Math.pow((pY - tY), 2));

			dirs[3].field = game.getMapContent(pX - 1, pY);
			dirs[3].dir = left;
			dirs[3].distance = Math.sqrt(Math.pow((pX - 1 - tX), 2) + Math.pow((pY - tY), 2));

			// Classifica possíveis direções por distância
			function compare(a, b) {
				if (a.distance < b.distance)
					return -1;
				if (a.distance > b.distance)
					return 1;
				return 0;
			}
			var dirs2 = dirs.sort(compare);

			var r = this.dir;
			var j;

			if (this.dead) {
				for (var i = dirs2.length - 1; i >= 0; i--) {
					if ((dirs2[i].field != "wall") && !(dirs2[i].dir.equals(this.getOppositeDirection()))) {
						r = dirs2[i].dir;
					}
				}
			} else {
				for (var i = dirs2.length - 1; i >= 0; i--) {
					if ((dirs2[i].field != "wall") && (dirs2[i].field != "door") && !(dirs2[i].dir.equals(this.getOppositeDirection()))) {
						r = dirs2[i].dir;
					}
				}
			}
			this.directionWatcher.set(r);
			return r;
		}
		this.setRandomDirection = function () {
			var dir = Math.floor((Math.random() * 10) + 1) % 5;

			switch (dir) {
				case 1:
					if (this.getOppositeDirection().equals(up)) this.setDirection(down);
					else this.setDirection(up);
					break;
				case 2:
					if (this.getOppositeDirection().equals(down)) this.setDirection(up);
					else this.setDirection(down);
					break;
				case 3:
					if (this.getOppositeDirection().equals(right)) this.setDirection(left);
					else this.setDirection(right);
					break;
				case 4:
					if (this.getOppositeDirection().equals(left)) this.setDirection(right);
					else this.setDirection(left);
					break;
			}
		}
		this.reverseDirection = function () {
			console.log("reverseDirection: " + this.direction.name + " to " + this.getOppositeDirection().name);
			this.directionWatcher.set(this.getOppositeDirection());
		}

	}

	Ghost.prototype = new Figure();

	// Super Classe para Pacman e Fantasmas
	function Figure() {
		this.posX;
		this.posY;
		this.speed;
		this.dirX = right.dirX;
		this.dirY = right.dirY;
		this.direction;
		this.stop = true;
		this.directionWatcher = new directionWatcher();
		this.getNextDirection = function () {
			console.log("Figure getNextDirection");
		};
		this.checkDirectionChange = function () {
			if (this.inGrid() && (this.directionWatcher.get() == null)) this.getNextDirection();
			if ((this.directionWatcher.get() != null) && this.inGrid()) {
				//console.log("changeDirection to "+this.directionWatcher.get().name);
				this.setDirection(this.directionWatcher.get());
				this.directionWatcher.set(null);
			}

		}


		this.inGrid = function () {
			if ((this.posX % (2 * this.radius) === 0) && (this.posY % (2 * this.radius) === 0)) return true;
			return false;
		}
		this.getOppositeDirection = function () {
			if (this.direction.equals(up)) return down;
			else if (this.direction.equals(down)) return up;
			else if (this.direction.equals(right)) return left;
			else if (this.direction.equals(left)) return right;
		}
		this.move = function () {

			if (!this.stop) {
				this.posX += this.speed * this.dirX;
				this.posY += this.speed * this.dirY;

				// Verifica se está fora da tela
				if (this.posX >= game.width - this.radius) this.posX = this.speed - this.radius;
				if (this.posX <= 0 - this.radius) this.posX = game.width - this.speed - this.radius;
				if (this.posY >= game.height - this.radius) this.posY = this.speed - this.radius;
				if (this.posY <= 0 - this.radius) this.posY = game.height - this.speed - this.radius;
			}
		}
		this.stop = function () {
			this.stop = true;
		}
		this.start = function () {
			this.stop = false;
		}

		this.getGridPosX = function () {
			return (this.posX - (this.posX % 30)) / 30;
		}
		this.getGridPosY = function () {
			return (this.posY - (this.posY % 30)) / 30;
		}
		this.setDirection = function (dir) {
			this.dirX = dir.dirX;
			this.dirY = dir.dirY;
			this.angle1 = dir.angle1;
			this.angle2 = dir.angle2;
			this.direction = dir;
		}
		this.setPosition = function (x, y) {
			this.posX = x;
			this.posY = y;
		}
	}

	function pacman() {
		this.radius = 15;
		this.posX = 0;
		this.posY = 6 * 2 * this.radius;
		this.speed = 5;
		this.angle1 = 0.25;
		this.angle2 = 1.75;
		this.mouth = 1; /* Alterna entre 1 e -1, dependendo do fechamento/abertura da boca */
		this.dirX = right.dirX;
		this.dirY = right.dirY;
		this.lives = 3;
		this.stuckX = 0;
		this.stuckY = 0;
		this.frozen = false; // usado para reproduzir o dado Animação
		this.freeze = function () {
			this.frozen = true;
		}
		this.unfreeze = function () {
			this.frozen = false;
		}
		this.getCenterX = function () {
			return this.posX + this.radius;
		}
		this.getCenterY = function () {
			return this.posY + this.radius;
		}
		this.directionWatcher = new directionWatcher();

		this.direction = right;

		this.beastMode = false;
		this.beastModeTimer = 0;

		this.checkCollisions = function () {

			if ((this.stuckX == 0) && (this.stuckY == 0) && this.frozen == false) {

				
                // Obtém a posição da grade de Pac
				var gridX = this.getGridPosX();
				var gridY = this.getGridPosY();
				var gridAheadX = gridX;
				var gridAheadY = gridY;

				var field = game.getMapContent(gridX, gridY);

				
                // obtém o campo 1 à frente para verificar as colisões na parede
				if ((this.dirX == 1) && (gridAheadX < 17)) gridAheadX += 1;
				if ((this.dirY == 1) && (gridAheadY < 12)) gridAheadY += 1;
				var fieldAhead = game.getMapContent(gridAheadX, gridAheadY);


				/*	Verifique a colisão da pílula			*/
				if ((field === "pill") || (field === "powerpill")) {
					//console.log("Pill found at ("+gridX+"/"+gridY+"). Pacman at ("+this.posX+"/"+this.posY+")");
					if (
						((this.dirX == 1) && (between(this.posX, game.toPixelPos(gridX) + this.radius - 5, game.toPixelPos(gridX + 1)))) ||
						((this.dirX == -1) && (between(this.posX, game.toPixelPos(gridX), game.toPixelPos(gridX) + 5))) ||
						((this.dirY == 1) && (between(this.posY, game.toPixelPos(gridY) + this.radius - 5, game.toPixelPos(gridY + 1)))) ||
						((this.dirY == -1) && (between(this.posY, game.toPixelPos(gridY), game.toPixelPos(gridY) + 5))) ||
						(fieldAhead === "wall")
					) {
						var s;
						if (field === "powerpill") {
							Sound.play("powerpill");
							s = POWERPILL_POINTS;
							this.enableBeastMode();
							game.startGhostFrightened();
						} else {
							Sound.play("waka");
							s = PILL_POINTS;
							game.pillCount--;
						}
						game.map.posY[gridY].posX[gridX].type = "null";
						game.score.add(s);
					}
				}

				/*	Verifique a colisão da parede			*/
				if ((fieldAhead === "wall") || (fieldAhead === "door")) {
					this.stuckX = this.dirX;
					this.stuckY = this.dirY;
					pacman.stop();
					// sai da parede
					if ((this.stuckX == 1) && ((this.posX % 2 * this.radius) != 0)) this.posX -= 5;
					if ((this.stuckY == 1) && ((this.posY % 2 * this.radius) != 0)) this.posY -= 5;
					if (this.stuckX == -1) this.posX += 5;
					if (this.stuckY == -1) this.posY += 5;
				}

			}
		}
		this.checkDirectionChange = function () {
			if (this.directionWatcher.get() != null) {
				console.groupCollapsed('checkDirectionChange');
				//console.log("next Direction: "+directionWatcher.get().name);

				if ((this.stuckX == 1) && this.directionWatcher.get() == right) this.directionWatcher.set(null);
				else {
					// redefinir eventos travados
					this.stuckX = 0;
					this.stuckY = 0;


					
                    // só permite mudanças de direção dentro da grade
					if ((this.inGrid())) {
						//console.log("changeDirection to "+directionWatcher.get().name);

						// verifica se é possível mudar de direção sem ficar preso
						console.debug("x: " + this.getGridPosX() + " + " + this.directionWatcher.get().dirX);
						console.debug("y: " + this.getGridPosY() + " + " + this.directionWatcher.get().dirY);
						var x = this.getGridPosX() + this.directionWatcher.get().dirX;
						var y = this.getGridPosY() + this.directionWatcher.get().dirY;
						if (x <= -1) x = game.width / (this.radius * 2) - 1;
						if (x >= game.width / (this.radius * 2)) x = 0;
						if (y <= -1) x = game.height / (this.radius * 2) - 1;
						if (y >= game.heigth / (this.radius * 2)) y = 0;

						console.debug("x: " + x);
						console.debug("y: " + y);
						var nextTile = game.map.posY[y].posX[x].type;
						console.debug("checkNextTile: " + nextTile);

						if (nextTile != "wall") {
							this.setDirection(this.directionWatcher.get());
							this.directionWatcher.set(null);
						}
					}
				}
				console.groupEnd();
			}
		}
		this.setDirection = function (dir) {
			if (!this.frozen) {
				this.dirX = dir.dirX;
				this.dirY = dir.dirY;
				this.angle1 = dir.angle1;
				this.angle2 = dir.angle2;
				this.direction = dir;
			}
		}
		this.enableBeastMode = function () {
			this.beastMode = true;
			this.beastModeTimer = 240;
			console.debug("Beast Mode activated!");
			azul.dazzle();
			rosa.dazzle();
			vermelho.dazzle();
			laranja.dazzle();
		};
		this.disableBeastMode = function () {
			this.beastMode = false;
			console.debug("Beast Mode is over!");
			azul.undazzle();
			rosa.undazzle();
			vermelho.undazzle();
			laranja.undazzle();
		};
		this.move = function () {

			if (!this.frozen) {
				if (this.beastModeTimer > 0) {
					this.beastModeTimer--;
					//console.log("Beast Mode: "+this.beastModeTimer);
				}
				if ((this.beastModeTimer == 0) && (this.beastMode == true)) this.disableBeastMode();

				this.posX += this.speed * this.dirX;
				this.posY += this.speed * this.dirY;

				// Verifica se está fora da tela
				if (this.posX >= game.width - this.radius) this.posX = 5 - this.radius;
				if (this.posX <= 0 - this.radius) this.posX = game.width - 5 - this.radius;
				if (this.posY >= game.height - this.radius) this.posY = 5 - this.radius;
				if (this.posY <= 0 - this.radius) this.posY = game.height - 5 - this.radius;
			} else this.dieAnimation();
		}

		this.eat = function () {

			if (!this.frozen) {
				if (this.dirX == this.dirY == 0) {

					this.angle1 -= this.mouth * 0.07;
					this.angle2 += this.mouth * 0.07;

					var limitMax1 = this.direction.angle1;
					var limitMax2 = this.direction.angle2;
					var limitMin1 = this.direction.angle1 - 0.21;
					var limitMin2 = this.direction.angle2 + 0.21;

					if (this.angle1 < limitMin1 || this.angle2 > limitMin2) {
						this.mouth = -1;
					}
					if (this.angle1 >= limitMax1 || this.angle2 <= limitMax2) {
						this.mouth = 1;
					}
				}
			}
		}
		this.stop = function () {
			this.dirX = 0;
			this.dirY = 0;
		}
		this.reset = function () {
			this.unfreeze();
			this.posX = 0;
			this.posY = 6 * 2 * this.radius;
			this.setDirection(right);
			this.stop();
			this.stuckX = 0;
			this.stuckY = 0;
			//console.log("reset pacman");
		}
		this.dieAnimation = function () {
			this.angle1 += 0.05;
			this.angle2 -= 0.05;
			if (this.angle1 >= this.direction.angle1 + 0.7 || this.angle2 <= this.direction.angle2 - 0.7) {
				this.dieFinal();
			}
		}
		this.die = function () {
			Sound.play("die");
			this.freeze();
			this.dieAnimation();
		}
		this.dieFinal = function () {
			this.reset();
			rosa.reset();
			azul.reset();
			vermelho.reset();
			laranja.reset();
			this.lives--;
			console.log("pacman died, " + this.lives + " lives left");
			if (this.lives <= 0) {
				game.endGame();
				game.showHighscoreForm();
			}
			game.drawHearts(this.lives);
		}
		this.getGridPosX = function () {
			return (this.posX - (this.posX % 30)) / 30;
		}
		this.getGridPosY = function () {
			return (this.posY - (this.posY % 30)) / 30;
		}
	}
	pacman.prototype = new Figure();
	var pacman = new pacman();
	game.buildWalls();


	
    // Verifica se um novo cache está disponível no carregamento da página.	 
	function checkAppCache() {
		console.log('check AppCache');
		window.applicationCache.addEventListener('updateready', function (e) {
			console.log("AppCache: updateready");
			if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {

				
                // O navegador baixou um novo cache de aplicativo.
                // Troque-o e recarregue a página para obter o novo hotness.
				window.applicationCache.swapCache();
				if (confirm('A new version of this site is available. Load it?')) {
					window.location.reload();
				}

			} else {
				// O manifesto não mudou. Nada de novo para o servidor.
			}
		}, false);

		window.applicationCache.addEventListener('cached', function (e) {
			console.log("AppCache: cached");
		}, false);

	}


	// A ação começa aqui:

	function hideAdressbar() {
		console.log("hide adressbar");
		$("html").scrollTop(1);
		$("body").scrollTop(1);
	}

	$(document).ready(function () {

		if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
			logger.disableLogger();
		}

		$.ajaxSetup({
			mimeType: "application/json"
		});

		$.ajaxSetup({
			beforeSend: function (xhr) {
				if (xhr.overrideMimeType) {
					xhr.overrideMimeType("application/json");
				}
			}
		});

		
        // Ocultar barra de endereços
		hideAdressbar();

		if (window.applicationCache != null) checkAppCache();

		/* -------------------- OUVIDORES DE EVENTOS-------------------------- */

		// Listen for resize changes
		/*window.addEventListener("resize", function() {
			// Get screen size (inner/outerWidth, inner/outerHeight)
			// deactivated because of problems
			if ((window.outerHeight < window.outerWidth) && (window.outerHeight < 720)) {
			game.pauseAndShowMessage("Rotate Device","Your screen is too small to play in landscape view.");
			console.log("rotate your device to portrait!");
			}
		}, false);*/


		// --------------- Controles


		
        // Teclado
		window.addEventListener('keydown', doKeyDown, true);

		// pausar/reiniciar o jogo na tela clique
		$('#canvas-container').click(function () {
			if (!(game.gameOver === true)) game.pauseResume();
		});

		// ouvinte de evento de envio de formulário de recordes
		$('body').on('click', '#score-submit', function () {
			console.log("submit highscore pressed");
			if ($('#playerName').val() === "" || $('#playerName').val() === undefined) {
				$('#form-validator').html("Please enter a name<br/>");
			} else {
				$('#form-validator').html("");
				addHighscore();
			}
		});

		$('body').on('click', '#show-highscore', function () {
			game.showContent('highscore-content');
			getHighscore();
		});

		// Hammerjs Touch Events
		Hammer('.container').on("swiperight", function (event) {
			if ($('#game-content').is(":visible")) {
				event.gesture.preventDefault();
				pacman.directionWatcher.set(right);
			}
		});
		Hammer('.container').on("swipeleft", function (event) {
			if ($('#game-content').is(":visible")) {
				event.gesture.preventDefault();
				pacman.directionWatcher.set(left);
			}
		});
		Hammer('.container').on("swipeup", function (event) {
			if ($('#game-content').is(":visible")) {
				event.gesture.preventDefault();
				pacman.directionWatcher.set(up);
			}
		});
		Hammer('.container').on("swipedown", function (event) {
			if ($('#game-content').is(":visible")) {
				event.gesture.preventDefault();
				pacman.directionWatcher.set(down);
			}
		});

		// Botões de controle móvel
		$(document).on('touchend mousedown', '#up', function (event) {
			event.preventDefault();
			pacman.directionWatcher.set(up);
		});
		$(document).on('touchend mousedown', '#down', function (event) {
			event.preventDefault();
			pacman.directionWatcher.set(down);
		});
		$(document).on('touchend mousedown', '#left', function (event) {
			event.preventDefault();
			pacman.directionWatcher.set(left);
		});
		$(document).on('touchend mousedown', '#right', function (event) {
			event.preventDefault();
			pacman.directionWatcher.set(right);
		});

		// Menu
		$(document).on('click', '.button#newGame', function (event) {
			game.newGame();
		});
		$(document).on('click', '.button#highscore', function (event) {
			game.showContent('highscore-content');
			getHighscore();
		});
		$(document).on('click', '.button#instructions', function (event) {
			game.showContent('instructions-content');
		});
		$(document).on('click', '.button#info', function (event) {
			game.showContent('info-content');
		});
		// botão "voltar
		$(document).on('click', '.button#back', function (event) {
			game.showContent('game-content');
		});
		// alterna Som
		$(document).on('click', '.controlSound', function (event) {
			game.toggleSound();
		});
		// receber as últimas
		$(document).on('click', '#updateCode', function (event) {
			console.log('check for new version');
			event.preventDefault();
			window.applicationCache.update();
		});

		// checkAppCache();

		canvas = $("#myCanvas").get(0);
		context = canvas.getContext("2d");

		/* --------------- INICIALIZAÇÃO DO JOGO ------------------------------------
		
			TODO: coloque isso no objeto Game e altere o código para aceitar configurações/níveis diferentes
		
		-------------------------------------------------------------------------- */

		game.init(0);

		renderContent();
	});

	function renderContent() {
		// Atualiza pontuação
		game.score.refresh(".score");

		// Comprimidos
		context.beginPath();
		context.fillStyle = "White";
		context.strokeStyle = "White";

		var dotPosY;
		if (game.map && game.map.posY && game.map.posY.length > 0) {
			$.each(game.map.posY, (i, row) => {
				dotPosY = row.row;
				$.each(row.posX, (j, column) => {
					if (column.type == "pill") {
						context.arc(game.toPixelPos(column.col - 1) + pacman.radius, game.toPixelPos(dotPosY - 1) + pacman.radius, game.pillSize, 0 * Math.PI, 2 * Math.PI);
						context.moveTo(game.toPixelPos(column.col - 1), game.toPixelPos(dotPosY - 1));
					} else if (column.type == "powerpill") {
						context.arc(game.toPixelPos(column.col - 1) + pacman.radius, game.toPixelPos(dotPosY - 1) + pacman.radius, game.powerpillSizeCurrent, 0 * Math.PI, 2 * Math.PI);
						context.moveTo(game.toPixelPos(column.col - 1), game.toPixelPos(dotPosY - 1));
					}
				});
			});
		} else {
			console.warn('Map not loaded (yet).')
		}

		context.fill();

		// Paredes
		context.drawImage(canvas_walls, 0, 0);


		if (game.started) {
			// Fantasmas
			rosa.draw(context);
			vermelho.draw(context);
			azul.draw(context);
			laranja.draw(context);


			// Pac Man
			context.beginPath();
			context.fillStyle = "Yellow";
			context.strokeStyle = "Yellow";
			context.arc(pacman.posX + pacman.radius, pacman.posY + pacman.radius, pacman.radius, pacman.angle1 * Math.PI, pacman.angle2 * Math.PI);
			context.lineTo(pacman.posX + pacman.radius, pacman.posY + pacman.radius);
			context.stroke();
			context.fill();
		}

	}

	// TODO: apenas para depuração
	function renderGrid(gridPixelSize, color) {
		context.save();
		context.lineWidth = 0.5;
		context.strokeStyle = color;

		// linhas de grade horizontais
		for (var i = 0; i <= canvas.height; i = i + gridPixelSize) {
			context.beginPath();
			context.moveTo(0, i);
			context.lineTo(canvas.width, i);
			context.closePath();
			context.stroke();
		}

		// linhas de grade verticais
		for (var i = 0; i <= canvas.width; i = i + gridPixelSize) {
			context.beginPath();
			context.moveTo(i, 0);
			context.lineTo(i, canvas.height);
			context.closePath();
			context.stroke();
		}

		context.restore();
	}


	function animationLoop() {

		// if (gameOver) return;

		canvas.width = canvas.width;
		// habilita a próxima linha para mostrar a grade
		// renderGrid(pacman.radius, "red");
		renderContent();

		if (game.dieAnimation == 1) pacman.dieAnimation();
		if (game.pause !== true) {
			// Faz alterações antes do próximo loop
			pacman.move();
			pacman.eat();
			pacman.checkDirectionChange();
			pacman.checkCollisions(); // tem que ser o ÚLTIMO método chamado no pacman

			vermelho.move();
			azul.move();
			rosa.move();
			laranja.move();

			game.checkGhostMode();


			
            // Todos os pontos coletados?
			game.checkForLevelUp();
		}

		//requestAnimationFrame(animationLoop);
		setTimeout(animationLoop, game.refreshRate);

	}



	function doKeyDown(evt) {

		switch (evt.keyCode) {
			case 38: // Tecla de seta para cima pressionada
				evt.preventDefault();
			case 87: // W pressionado
				pacman.directionWatcher.set(up);
				break;
			case 40: // Seta PARA BAIXO pressionada
				evt.preventDefault();
			case 83: // S pressionado
				pacman.directionWatcher.set(down);
				break;
			case 37: // Tecla de seta ESQUERDA pressionada
				evt.preventDefault();
			case 65: // A pressionado
				pacman.directionWatcher.set(left);
				break;
			case 39: // Seta DIREITA pressionada
				evt.preventDefault();
			case 68: //D pressionado
				pacman.directionWatcher.set(right);
				break;
			case 78: // N pressionado
				if (!$('#playerName').is(':focus')) {
					game.pause = 1;
					game.newGame();
				}
				break;
			case 77: // M pressionado
				game.toggleSound();
				break;
			case 8: // Backspace pressionado -> mostra o conteúdo do jogo
			case 27:// ESC pressionado -> mostra o conteúdo do jogo
				if (!$('#playerName').is(':focus')) {
					evt.preventDefault();
					game.showContent('game-content');
				}
				break;
			case 32: // ESPAÇO pressionado -> pausa o jogo
				evt.preventDefault();
				if (!(game.gameOver == true) &&
					$('#game-content').is(':visible')
				) game.pauseResume();
				break;
		}
	}
}

geronimo();