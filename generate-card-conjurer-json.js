const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// Configuration constants
const WIDTH_NO_BLEED = 2.48;
const BLEED_WIDTH = 0.24;
const COLOR_TO_FRAME_MAP = {
  '{W}': { name: 'White Frame', src: '/img/frames/m15/fullTextAlt/w.png' },
  '{U}': { name: 'Blue Frame', src: '/img/frames/m15/fullTextAlt/u.png' },
  '{B}': { name: 'Black Frame', src: '/img/frames/m15/fullTextAlt/b.png' },
  '{R}': { name: 'Red Frame', src: '/img/frames/m15/fullTextAlt/r.png' },
  '{G}': { name: 'Green Frame', src: '/img/frames/m15/fullTextAlt/g.png' },
  '{C}': { name: 'Colorless Frame', src: '/img/frames/m15/fullTextAlt/c.png' },
  'multicolor': { name: 'Multicolor Frame', src: '/img/frames/m15/fullTextAlt/m.png' }
};

const COLOR_TO_WATERMARK_MAP = {
  '{W}': '#b79d58',
  '{U}': '#8cacc5',
  '{B}': '#5e5e5e',
  '{R}': '#c66d39',
  '{G}': '#598c52',
  'multicolor': '#cab34d'
};

const SCRYFALL_DELAY_MS = 100;

// Supported languages for internationalization
const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'ja'];
const DEFAULT_LANGUAGE = 'en';

// Card Conjurer template (embedded)
const CARD_TEMPLATE = {
  "width": 2010,
  "height": 2814,
  "marginX": 0.044,
  "marginY": 0.02857142857142857,
  "frames": [
    {
      "name": "Black Extension",
      "src": "/img/frames/margins/blackBorderExtension.png",
      "bounds": {
        "x": -0.044,
        "y": -0.02857142857142857,
        "width": 1.088,
        "height": 1.0571428571428572
      },
      "masks": []
    },
    {
      "name": "White Frame",
      "src": "/img/frames/m15/fullTextAlt/w.png",
      "masks": []
    }
  ],
  "artSource": "https://cardconjurer.app/img/blank.png",
  "artX": -0.04378109452736319,
  "artY": -0.029850746268656716,
  "artZoom": 88,
  "artRotate": "0",
  "setSymbolSource": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDcuNDE3NTQiIGhlaWdodD0iMjM3LjMyMjM1IiB2aWV3Qm94PSIwIDAgMjA3LjQxNzU0IDIzNy4zMjIzNSI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiNmZmY7fTwvc3R5bGU+PC9kZWZzPjxnIGlkPSJMYXllcl8yX2NvcHlfNSI+PHBhdGggZD0iTTE5MS4wNzYzNCwxMTUuOTgzN2MtNy42NTk5Ny0uNTIwMDItNy42NDk5Niw3LjI2MDAxLTEwLjg3LDEyLjY5LS43NzAwMiwxLjI4OTk4LjE3OTk5LDIuNTI5OTctMi40ODk5OSwxLjk2OTk3LDIuMzQwMDMtMjIuMzgsNC00NS4xMi0yLjQ4OTk5LTY3LTcuNTQ5OTktMjUuNDY5OTctMjguNjA5OTktNDcuMjAwMDEtNTUuNTEwMDEtNTAuOTc5OThsMTEuNSw2Mi45ODk5OWgzMi41bC02MCw2OC40NTAwMS02MC02OC40NTAwMWgzMi41bDExLjUtNjIuOTg5OTljLTQ0Ljk0LDcuMjcwMDItNjMuNTM5OTgsNTIuOTU5OTYtNjAuMDM5OTgsOTQuNTI5OTdsMi4wMzk5OCwyMy40NTAwMWMtMi4yMTk5Ny41NDk5OS0zLjYzLTMuNTk5OTgtNC4zOC01LjEyLTIuNDUwMDEtNC45ODk5OS0xLjY5LTkuODM5OTctOC43NzAwMi05LjMxLTEyLjA2OTk1LjkwOTk3LTUuNDQsMjMuMzMwMDItMi42MDk5OSwzMC43MDAwMSw0LjAzMDAzLDEwLjQ3OTk4LDEyLjEyLDIyLjMzOTk3LDI0LjgxLDIxLjE5LDguODQwMDMsMjQuNjc5OTksMzAuNjA5OTksNDkuNzc5OTcsNTUuOTg5OTksNTguMDEwMDEsNy43MzAwNCwyLjUsMTAuMjAwMDEsMi41LDE3LjkyMDA0LDAsMjAuNTk5OTgtNi42Nzk5OSw0MC4xMi0yNS45NTAwMSw1MC4yMDk5Ni00NC43OTAwNCwxLjIwMDAxLTIuMjUsNS4xNzk5OS0xMi44MjAwMSw1Ljc5MDA0LTEzLjIwOTk2LDEuNjQ5OTYtMS4xMDAwNCw2LjgzOTk3LDAsMTAuMzEtMS42OSw1LjY0OTk2LTIuNzM5OTksMTIuMjYwMDEtMTMuNzAwMDEsMTQuNDg5OTktMTkuNTEwMDEsMi42NDk5Ni02Ljg5MDAxLDkuMDgwMDItMzAuMTUwMDItMi40MDAwMi0zMC45Mjk5OVpNOTIuNzA2MzUsMTUxLjY1MzY4bC0yLjk3OTk4LTFjMi4yMzk5OSwxMS41MjAwMi02LjEyLDEzLjI3MDAyLTE1LjUyMDAyLDEzLjk3OTk4LTE2Ljc1LDEuMjYwMDEtMjkuNDg5OTktNy41MTk5Ni0zNC4xNDk5Ni0yMy41LjM4OTk1LTMuNDc5OTgsMTguMTQ5OTYtMTMuMzIwMDEsMjIuNjQ5OTYtMTAuNDc5OTgtMi4wMTAwMS02LjQ4OTk5LTEwLjY3OTk5LTUuMjM5OTktMTUuOTc5OTgtNC4wMTAwMSwxLjk0LTIuNjIsOC0zLjc4OTk4LDExLjAzOTk4LTMuNTM5OTgsNi43ODAwMy41NzAwMSwxNS4yOTk5OSw3LjIwOTk2LDIwLjQxOTk4LDExLjU4MDAyLDIuMDEwMDEsMS43MDk5NiwxNi4xODAwNSwxNS4wNzk5NiwxNC41MjAwMiwxNi45Njk5N1pNMTMzLjIxNjM2LDE2NC42MzM2NmMtOS40MDk5Ny0uNzA5OTYtMTcuNzYwMDEtMi40NTk5Ni0xNS41MjAwMi0xMy45Nzk5OGwtMi45ODk5OSwxYy0xLjY1OTk3LTEuODkwMDEsMTIuNTIwMDItMTUuMjYwMDEsMTQuNTIwMDItMTYuOTY5OTcsNS4xMy00LjM3MDA2LDEzLjY0MDAxLTExLjAxMDAxLDIwLjQxOTk4LTExLjU4MDAyLDMuMDQ5OTktLjI1LDkuMTA5OTkuOTE5OTgsMTEuMDQ5OTksMy41Mzk5OC01LjMxLTEuMjI5OTgtMTMuOTY5OTctMi40Nzk5OC0xNS45ODk5OSw0LjAxMDAxLDQuNTEwMDEtMi44NDAwMywyMi4yNzAwMiw3LDIyLjY1MDAyLDEwLjQ3OTk4LTQuNjUwMDIsMTUuOTgwMDQtMTcuMzkwMDEsMjQuNzYwMDEtMzQuMTQwMDEsMjMuNVoiLz48cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik03OC4xODYzMywxMzQuNjgzNzFjLTUuMTItNC4zNzAwNi0xMy42Mzk5NS0xMS4wMTAwMS0yMC40MTk5OC0xMS41ODAwMi0zLjAzOTk4LS4yNS05LjA5OTk4LjkxOTk4LTExLjAzOTk4LDMuNTM5OTgsNS4yOTk5OS0xLjIyOTk4LDEzLjk2OTk3LTIuNDc5OTgsMTUuOTc5OTgsNC4wMTAwMS00LjUtMi44NDAwMy0yMi4yNjAwMSw3LTIyLjY0OTk2LDEwLjQ3OTk4LDQuNjU5OTcsMTUuOTgwMDQsMTcuMzk5OTYsMjQuNzYwMDEsMzQuMTQ5OTYsMjMuNSw5LjQwMDAyLS43MDk5NiwxNy43NjAwMS0yLjQ1OTk2LDE1LjUyMDAyLTEzLjk3OTk4bDIuOTc5OTgsMWMxLjY2MDAzLTEuODkwMDEtMTIuNTEwMDEtMTUuMjYwMDEtMTQuNTIwMDItMTYuOTY5OTdaTTg0LjQ0Mzk2LDE0OC4yNDc2MWMtMS4wMDA2MS0xLjYwODc2LTIuODc5MDktMy42NTE3My01LjA2NzQ0LTUuNjc4MSwyLjE4OTU4LDIuMDI2ODYsNC4wNjg2Niw0LjA3MDA3LDUuMDY3NDQsNS42NzgxWk04MS41ODIzMiwxNTkuMTI1ODVjLS4wNjk0LjAyNzY1LS4xNDI0LjA1MjI1LS4yMTMwMS4wNzg3NC4wNzA2Mi0uMDI2NDkuMTQzNjItLjA1MTE1LjIxMzAxLS4wNzg3NFpNODEuMDMyMDksMTU5LjMyOTE2Yy0uMTI2NTkuMDQzNC0uMjU3MjYuMDgzMTMtLjM4NzI3LjEyMzQxLjEzLS4wNDAyOC4yNjA3NC0uMDgwMDIuMzg3MjctLjEyMzQxWk04MC40NTc5MywxNTkuNTEyMDhjLS4xMzQ1OC4wMzk3OS0uMjczMDEuMDc2MDUtLjQxMDg5LjExMjc5LjEzNzg4LS4wMzY4LjI3NjMxLS4wNzMwNi40MTA4OS0uMTEyNzlaTTc5Ljg2MTk4LDE1OS42NzU2NWMtLjA3NTgxLjAxOTI5LS4xNTQyNC4wMzYxMy0uMjMwOTYuMDU0NjMuMDc2NzItLjAxODQ5LjE1NTE1LS4wMzUzNC4yMzA5Ni0uMDU0NjNaTTYzLjc3NzM5LDEzMy44MDA1M2MtNi44ODMyNC0uMDkzODctMTMuNDE0LDQuNDM1NzMtMTkuMDQwOTUsNy44ODMyNGwtLjAwMDA2LS4wMDAwNmM1LjYyNDY5LTMuNDQ3NjksMTIuMTU1MDMtNy45ODE3NSwxOS4wNDEwMi03Ljg4MzE4Wk0xNDQuNzA2MzUsMTMwLjY1MzY4YzIuMDIwMDItNi40ODk5OSwxMC42Nzk5OS01LjIzOTk5LDE1Ljk4OTk5LTQuMDEwMDEtMS45NC0yLjYyLTgtMy43ODk5OC0xMS4wNDk5OS0zLjUzOTk4LTYuNzc5OTcuNTcwMDEtMTUuMjg5OTgsNy4yMDk5Ni0yMC40MTk5OCwxMS41ODAwMi0yLDEuNzA5OTYtMTYuMTc5OTksMTUuMDc5OTYtMTQuNTIwMDIsMTYuOTY5OTdsMi45ODk5OS0xYy0yLjIzOTk5LDExLjUyMDAyLDYuMTEwMDUsMTMuMjcwMDIsMTUuNTIwMDIsMTMuOTc5OTgsMTYuNzUsMS4yNjAwMSwyOS40ODk5OS03LjUxOTk2LDM0LjE0MDAxLTIzLjUtLjM4LTMuNDc5OTgtMTguMTQwMDEtMTMuMzIwMDEtMjIuNjUwMDItMTAuNDc5OThaTTE0Ny42NjY0OSwxMzQuMjI3MjljMS41MzMyLjMyNTA3LDMuMDQ0MDcuODI2NjYsNC41MjAyNiwxLjQ0NjExLTEuNDc2MjYtLjYxOTItMi45ODcwNi0xLjEyMDczLTQuNTIwMjYtMS40NDYxMVpNMTg3LjcwNjM1LDEwNi42NTM2OGMxLjQ4OTk5LTI2Ljk2MDAyLTMuNDI5OTktNTkuMTU5OTctMjIuMzM5OTctNzkuNjUwMDJDMTQ0LjEzNjM0LDQuMDEzNjcsMTA4LjE5NjM0LTYuMTk2Myw3OC40MzYzMywzLjg3MzY1LDMzLjIzNjM3LDE5LjE4MzcxLDE2LjQxNjM3LDYxLjU5MzY4LDE5LjcyNjM2LDEwNi42NTM2OGMtMjcuNDYwMDItMi4xNTAwMi0yMC42NTAwMiwzMy4zMjAwMS0xMi43MjAwMyw0OS4yMTAwMiwyLjgxLDUuNjMsOS4xNDAwMSwxNC4xNjk5OCwxNC4zOCwxNy42MiwzLjIzMDA0LDIuMTMsOS41MzAwMywzLjAxMDAxLDEwLjg0MDAzLDQuMTU5OTcuNzYwMDEuNjYwMDMsNy4yNjAwMSwxNC42NjAwMyw5LjI2MDAxLDE3LjczOTk5LDE0LjAzOTk4LDIxLjU3MDAxLDQ1LjUzOTk4LDQ4LjM3LDczLjAxMDAxLDQwLjU1MDA1LDI0Ljc2OTk2LTcuMDUwMDUsNDUuMjU5OTUtMjguNjgwMDUsNTcuMzk5OTYtNTAuNjAwMDQsMS4wNi0xLjkwOTk3LDEuOTAwMDItNi40NjAwMiwzLjMxLTcuNjksMS4zMS0xLjE0OTk2LDcuNjA5OTktMi4wMjk5NywxMC44NDAwMy00LjE1OTk3LDEwLjEzOTk1LTYuNjc5OTksMTguNDQtMjMuODYwMDUsMjAuNDE5OTgtMzUuNTgwMDIsMi41ODAwMi0xNS4zMzAwMiwxLjAxMDAxLTMyLjkyOTk5LTE4Ljc2MDAxLTMxLjI1Wk0xMTQuODM2MzUsMTIuMjMzN2wxMi4zOCw2OC40MTk5OC0xMi4zODA1NS02OC40MTY1NmMtNy4xODAzLTIuMjAwNjgtMTUuMDM3MjktMi4yMDY0OC0yMi4yMzg4OSwwbC0xMy4zODA1NSw2OC40MTY1NiwxMy4zOC02OC40MTk5OGM3LjIwMDAxLTIuMjAwMDEsMTUuMDYtMi4yMDAwMSwyMi4yMzk5OSwwWk0xNTIuNzE2MzYsODAuNjUzNjhsLTQ5LDU2LjQyOTk5LTQ5LTU2LjQyOTk5LDQ5LDU2LjQyODM0LDQ5LTU2LjQyODM0Wk0xOTMuNDc2MzYsMTQ2LjkxMzY5Yy0yLjIyOTk4LDUuODEtOC44NDAwMywxNi43NzAwMi0xNC40ODk5OSwxOS41MTAwMS0zLjQ3MDAzLDEuNjktOC42NjAwMy41ODk5Ny0xMC4zMSwxLjY5LS42MTAwNS4zODk5NS00LjU5MDAzLDEwLjk1OTk2LTUuNzkwMDQsMTMuMjA5OTYtMTAuMDg5OTcsMTguODQwMDMtMjkuNjA5OTksMzguMTEwMDUtNTAuMjA5OTYsNDQuNzkwMDQtNy43MjAwMywyLjUtMTAuMTksMi41LTE3LjkyMDA0LDAtMjUuMzgtOC4yMzAwNC00Ny4xNDk5Ni0zMy4zMzAwMi01NS45ODk5OS01OC4wMTAwMS0xMi42OSwxLjE0OTk2LTIwLjc3OTk3LTEwLjcxMDAyLTI0LjgxLTIxLjE5LTIuODMwMDItNy4zNy05LjQ1OTk2LTI5Ljc5MDA0LDIuNjA5OTktMzAuNzAwMDEsNy4wODAwMi0uNTI5OTcsNi4zMjAwMSw0LjMyMDAxLDguNzcwMDIsOS4zMS43NSwxLjUyMDAyLDIuMTYwMDMsNS42Njk5OCw0LjM4LDUuMTJsLTIuMDM5OTgtMjMuNDUwMDFjLTMuNS00MS41NzAwMSwxNS4wOTk5OC04Ny4yNTk5NSw2MC4wMzk5OC05NC41Mjk5N2wtMTEuNSw2Mi45ODk5OWgtMzIuNWw2MCw2OC40NTAwMSw2MC02OC40NTAwMWgtMzIuNWwtMTEuNS02Mi45ODk5OWMyNi45MDAwMiwzLjc3OTk3LDQ3Ljk2MDAyLDI1LjUxMDAxLDU1LjUxMDAxLDUwLjk3OTk4LDYuNDg5OTksMjEuODgsNC44MzAwMiw0NC42MiwyLjQ4OTk5LDY3LDIuNjY5OTguNTYsMS43MTk5Ny0uNjc5OTksMi40ODk5OS0xLjk2OTk3LDMuMjIwMDMtNS40Mjk5OSwzLjIxMDAyLTEzLjIxMDAyLDEwLjg3LTEyLjY5LDExLjQ4MDA0Ljc3OTk3LDUuMDQ5OTksMjQuMDM5OTgsMi40MDAwMiwzMC45Mjk5OVoiLz48L2c+PC9zdmc+",
  "setSymbolX": 0.8835820895522388,
  "setSymbolY": 0.9317697228144989,
  "setSymbolZoom": 0.485,
  "watermarkSource": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8yIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDcuNDE3NTQiIGhlaWdodD0iMjM3LjMyMjM1IiB2aWV3Qm94PSIwIDAgMjA3LjQxNzU0IDIzNy4zMjIzNSI+PGcgaWQ9IkxheWVyXzJfY29weV83Ij48cGF0aCBkPSJNODAuODczMjgsMTQ0LjAwOTE1Yy4wNTY5NS4wNTY4OC4xMTMwNC4xMTM3MS4xNjkxOS4xNzA0Ny0uMDU2MjctLjA1NjgyLS4xMTIxOC0uMTEzNDYtLjE2OTE5LS4xNzA0N1oiLz48cGF0aCBkPSJNODIuMzM1NjIsMTQ1LjU0MzU3Yy4wMDc1MS4wMDgzLjAxNTY5LjAxNjg1LjAyMzEzLjAyNTE1LS4wMDc0NS0uMDA4My0uMDE1NjItLjAxNjc4LS4wMjMxMy0uMDI1MTVaIi8+PHBhdGggZD0iTTgyLjkzODcxLDE0Ni4yMzM0NWMuMDQ1NTkuMDUzODMuMDg4MDcuMTA2MzIuMTMyNTcuMTU5NjctLjA0NDU2LS4wNTM0MS0uMDg2OTEtLjEwNTgzLS4xMzI1Ny0uMTU5NjdaIi8+PHBhdGggZD0iTTgxLjU3MDYsMTQ0LjcyMjM0Yy4wNTM0MS4wNTU4NS4xMDc2Ny4xMTE4Mi4xNjAyMi4xNjc0Mi0uMDUyNjctLjA1NTY2LS4xMDY3NS0uMTExNTctLjE2MDIyLS4xNjc0MloiLz48cGF0aCBkPSJNODMuNDU2NTksMTQ2Ljg2Njg4Yy4wNTM0Ny4wNjc2My4xMDU1My4xMzQ2NC4xNTY5Mi4yMDEzNS0uMDUxNDUtLjA2Njc3LS4xMDMzOS0uMTMzNjctLjE1NjkyLS4yMDEzNVoiLz48cGF0aCBkPSJNNDcuOTYzMzYsMTM5LjY4NjUyYy4wMTM3OS0uMDA4NDguMDI3NTktLjAxNzAzLjA0MTQ0LS4wMjU1MS0uMDEzODUuMDA4NTQtLjAyNzU5LjAxNzAzLS4wNDE0NC4wMjU1MVoiLz48cGF0aCBkPSJNNDkuMDk0OSwxMzguOTk4MWMuMDE1NS0uMDA5MzQuMDMxMTMtLjAxODY4LjA0NjY5LS4wMjgwMi0uMDE1NjIuMDA5MzQtLjAzMTEzLjAxODYyLS4wNDY2OS4wMjgwMloiLz48cGF0aCBkPSJNODMuOTM1OTYsMTQ3LjUwMDZjLjA0MjQ4LjA1ODc4LjA4NjczLjExODQxLjEyNzM4LjE3NjI3LS4wNDA2NS0uMDU3OTgtLjA4NDg0LS4xMTc0My0uMTI3MzgtLjE3NjI3WiIvPjxwYXRoIGQ9Ik0xNDQuNzA2MzUsMTMwLjY1MzY4YzIuMDIwMDItNi40ODk5OSwxMC42Nzk5OS01LjIzOTk5LDE1Ljk4OTk5LTQuMDEwMDEtMS45NC0yLjYyLTgtMy43ODk5OC0xMS4wNDk5OS0zLjUzOTk4LTYuNzc5OTcuNTcwMDEtMTUuMjg5OTgsNy4yMDk5Ni0yMC40MTk5OCwxMS41ODAwMi0yLDEuNzA5OTYtMTYuMTc5OTksMTUuMDc5OTYtMTQuNTIwMDIsMTYuOTY5OTdsMi45ODk5OS0xYy0yLjIzOTk5LDExLjUyMDAyLDYuMTEwMDUsMTMuMjcwMDIsMTUuNTIwMDIsMTMuOTc5OTgsMTYuNzUsMS4yNjAwMSwyOS40ODk5OS03LjUxOTk2LDM0LjE0MDAxLTIzLjUtLjM4LTMuNDc5OTgtMTguMTQwMDEtMTMuMzIwMDEtMjIuNjUwMDItMTAuNDc5OThaTTEyNi42NjQ5LDE1OS4yMDQ4OWMtNi42ODE4Mi0xLjg4NDA5LTUuOTI1MTEtOC45MzQzMy0yLjQwMjIyLTEzLjUwNDgyLDIuMjgxNjItMi45NjAxNCwxNC40MjMzNC0xMS41MTgwNywxOC4yNDE1Mi0xMS44MzkyMywyLjA1MDYtLjE3MjQ5LDQuMDkzMDIuMDczMyw2LjA5NTUyLjU5MTMxLjA5MTc0LjAyMzc0LjE4Mzc4LjA0NDg2LjI3NTMzLjA2OTgyLjMwNDE0LjA4MjcuNjA2NTcuMTc0MjYuOTA4NTcuMjY5MjkuMDg3MzQuMDI3NTMuMTc0OTMuMDU0Mi4yNjIwOC4wODI3LjMxNjY1LjEwMzQ1LjYzMTU5LjIxMzQ0Ljk0NTU2LjMyOTI4LjA1NzMxLjAyMTE4LjExNDUuMDQyNi4xNzE3NS4wNjQxNS4zNDMwMi4xMjkwOS42ODQyLjI2MzU1LDEuMDIzNS40MDU4OC4wMDAwNi4wMDAwNi4wMDAxOC4wMDAwNi4wMDAyNC4wMDAxMi0uMDAwMDYtLjAwMDA2LS4wMDAxOC0uMDAwMDYtLjAwMDI0LS4wMDAxMiwzLjY2ODI3LDEuNTM4NjQsNy4xMTU2LDMuODA1OTcsMTAuMTAzNzYsNS45NjEyNC01LjQ0MjYzLDE1LjUzMjQxLTE5LjgzNTA4LDIyLjAyMjgzLTM1LjYyNTM3LDE3LjU3MDM3WiIvPjxwYXRoIGQ9Ik0xNTEuMTU1NjksMTM1LjI2NDY0Yy0uMDUyNDMtLjAxOTcxLS4xMDQ4LS4wMzkzMS0uMTU3MjMtLjA1ODcyLjA1MjQzLjAxOTQxLjEwNDg2LjAzOS4xNTcyMy4wNTg3MloiLz48cGF0aCBkPSJNMTg3LjcwNjM1LDEwNi42NTM2OGMxLjQ4OTk5LTI2Ljk2MDAyLTMuNDI5OTktNTkuMTU5OTctMjIuMzM5OTctNzkuNjUwMDJDMTQ0LjEzNjM0LDQuMDEzNjcsMTA4LjE5NjM0LTYuMTk2Myw3OC40MzYzMywzLjg3MzY1LDMzLjIzNjM3LDE5LjE4MzcxLDE2LjQxNjM3LDYxLjU5MzY4LDE5LjcyNjM2LDEwNi42NTM2OGMtMjcuNDYwMDItMi4xNTAwMi0yMC42NTAwMiwzMy4zMjAwMS0xMi43MjAwMyw0OS4yMTAwMiwyLjgxLDUuNjMsOS4xNDAwMSwxNC4xNjk5OCwxNC4zOCwxNy42MiwzLjIzMDA0LDIuMTMsOS41MzAwMywzLjAxMDAxLDEwLjg0MDAzLDQuMTU5OTcuNzYwMDEuNjYwMDMsNy4yNjAwMSwxNC42NjAwMyw5LjI2MDAxLDE3LjczOTk5LDE0LjAzOTk4LDIxLjU3MDAxLDQ1LjUzOTk4LDQ4LjM3LDczLjAxMDAxLDQwLjU1MDA1LDI0Ljc2OTk2LTcuMDUwMDUsNDUuMjU5OTUtMjguNjgwMDUsNTcuMzk5OTYtNTAuNjAwMDQsMS4wNi0xLjkwOTk3LDEuOTAwMDItNi40NjAwMiwzLjMxLTcuNjksMS4zMS0xLjE0OTk2LDcuNjA5OTktMi4wMjk5NywxMC44NDAwMy00LjE1OTk3LDEwLjEzOTk1LTYuNjc5OTksMTguNDQtMjMuODYwMDUsMjAuNDE5OTgtMzUuNTgwMDIsMi41ODAwMi0xNS4zMzAwMiwxLjAxMDAxLTMyLjkyOTk5LTE4Ljc2MDAxLTMxLjI1Wk0xMTQuODM2MzUsMTIuMjMzN2wxMi4zOCw2OC40MTk5OGgyNS41bC00OSw1Ni40Mjk5OS00OS01Ni40Mjk5OWgyNC41bDEzLjM4LTY4LjQxOTk4YzcuMjAwMDEtMi4yMDAwMSwxNS4wNi0yLjIwMDAxLDIyLjIzOTk5LDBaTTE5My40NzYzNiwxNDYuOTEzNjljLTIuMjI5OTgsNS44MS04Ljg0MDAzLDE2Ljc3MDAyLTE0LjQ4OTk5LDE5LjUxMDAxLTMuNDcwMDMsMS42OS04LjY2MDAzLjU4OTk3LTEwLjMxLDEuNjktLjYxMDA1LjM4OTk1LTQuNTkwMDMsMTAuOTU5OTYtNS43OTAwNCwxMy4yMDk5Ni0xMC4wODk5NywxOC44NDAwMy0yOS42MDk5OSwzOC4xMTAwNS01MC4yMDk5Niw0NC43OTAwNC03LjcyMDAzLDIuNS0xMC4xOSwyLjUtMTcuOTIwMDQsMC0yNS4zOC04LjIzMDA0LTQ3LjE0OTk2LTMzLjMzMDAyLTU1Ljk4OTk5LTU4LjAxMDAxLTEyLjY5LDEuMTQ5OTYtMjAuNzc5OTctMTAuNzEwMDItMjQuODEtMjEuMTktMi44MzAwMi03LjM3LTkuNDU5OTYtMjkuNzkwMDQsMi42MDk5OS0zMC43MDAwMSw3LjA4MDAyLS41Mjk5Nyw2LjMyMDAxLDQuMzIwMDEsOC43NzAwMiw5LjMxLjc1LDEuNTIwMDIsMi4xNjAwMyw1LjY2OTk4LDQuMzgsNS4xMmwtMi4wMzk5OC0yMy40NTAwMWMtMy41LTQxLjU3MDAxLDE1LjA5OTk4LTg3LjI1OTk1LDYwLjAzOTk4LTk0LjUyOTk3bC0xMS41LDYyLjk4OTk5aC0zMi41bDYwLDY4LjQ1MDAxLDYwLTY4LjQ1MDAxaC0zMi41bC0xMS41LTYyLjk4OTk5YzI2LjkwMDAyLDMuNzc5OTcsNDcuOTYwMDIsMjUuNTEwMDEsNTUuNTEwMDEsNTAuOTc5OTgsNi40ODk5OSwyMS44OCw0LjgzMDAyLDQ0LjYyLDIuNDg5OTksNjcsMi42Njk5OC41NiwxLjcxOTk3LS42Nzk5OSwyLjQ4OTk5LTEuOTY5OTcsMy4yMjAwMy01LjQyOTk5LDMuMjEwMDItMTMuMjEwMDIsMTAuODctMTIuNjksMTEuNDgwMDQuNzc5OTcsNS4wNDk5OSwyNC4wMzk5OCwyLjQwMDAyLDMwLjkyOTk5WiIvPjxwYXRoIGQ9Ik0xNDguNjA3NjUsMTM0LjQ1NDE2Yy4wODgxMy4wMjI4My4xNzY1Ny4wNDMxNS4yNjQ0Ny4wNjcwOC0uMDg3OTUtLjAyMzk5LS4xNzYzOS0uMDQ0MTktLjI2NDQ3LS4wNjcwOFoiLz48cGF0aCBkPSJNNzguMTg2MzMsMTM0LjY4MzcxYy01LjEyLTQuMzcwMDYtMTMuNjM5OTUtMTEuMDEwMDEtMjAuNDE5OTgtMTEuNTgwMDItMy4wMzk5OC0uMjUtOS4wOTk5OC45MTk5OC0xMS4wMzk5OCwzLjUzOTk4LDUuMjk5OTktMS4yMjk5OCwxMy45Njk5Ny0yLjQ3OTk4LDE1Ljk3OTk4LDQuMDEwMDEtNC41LTIuODQwMDMtMjIuMjYwMDEsNy0yMi42NDk5NiwxMC40Nzk5OCw0LjY1OTk3LDE1Ljk4MDA0LDE3LjM5OTk2LDI0Ljc2MDAxLDM0LjE0OTk2LDIzLjUsOS40MDAwMi0uNzA5OTYsMTcuNzYwMDEtMi40NTk5NiwxNS41MjAwMi0xMy45Nzk5OGwyLjk3OTk4LDFjMS42NjAwMy0xLjg5MDAxLTEyLjUxMDAxLTE1LjI2MDAxLTE0LjUyMDAyLTE2Ljk2OTk3Wk03My4xNDkwMywxNjAuNTM2MzdjLTEzLjc3MTY3Ljc3OTQ4LTIzLjE1MTI1LTYuNjE4OTYtMjguNDE1OTUtMTguODUwNTIuMDAxMjgtLjAwMDc5LjAwMjY5LS4wMDE2NS4wMDM5Ny0uMDAyNDQtLjAwMDE4LjAwMDEyLS4wMDA0My4wMDAyNC0uMDAwNjEuMDAwMzdsLS4wMDAwNi0uMDAwMDZjLjA2NzI2LS4wNDEyNi4xMzYyOS0uMDg0MzUuMjAzODYtLjEyNTkyLjMyMjc1LS4xOTg0OS42NDczNC0uMzk4OTkuOTc1ODMtLjYwMzA5LjM1MTItLjIxODIuNzA1NDQtLjQzODU0LDEuMDYyOTktLjY2MDU4LjE5OTgzLS4xMjQyMS40MDA1MS0uMjQ3NzQuNjAyMjMtLjM3MjUuMTk5NjUtLjEyMzQxLjM5OTM1LS4yNDYyMi42MDA4OS0uMzY5NzUuMjQzNDctLjE0OTQxLjQ4Nzc5LS4yOTc2MS43MzM4OS0uNDQ2NTMuMTQ0MzUtLjA4NzIyLjI4OTEyLS4xNzM2NS40MzQzMy0uMjYwNDQuMjgxOC0uMTY4NjQuNTYzOS0uMzM2MDYuODQ4OTQtLjUwMjQ0LjA3NzUxLS4wNDUxNy4xNTU3Ni0uMDg5MjMuMjMzNTItLjEzNDE2LDEuNDY5OTctLjg1MTE0LDIuOTgwOTYtMS42NTQzNiw0LjUyNjM3LTIuMzQxNzQuMDE0ODMtLjAwNjU5LjAyOTY2LS4wMTM0My4wNDQ0OS0uMDE5OTYuMzkwNjktLjE3MzE2Ljc4MzUxLS4zMzYzLDEuMTc4NDEtLjQ5MjYxLjAxODI1LS4wMDcyLjAzNjUtLjAxNDM0LjA1NDc1LS4wMjE0OCwzLjYyNjk1LTEuNDI3MTIsNy40MjM0Ni0yLjA5NzI5LDExLjMwMDU0LTEuMDExNTQsMi41NTEzMy43MTQ1NCw3LjczOTkzLDQuNDUyNywxMS44Mzk2LDguMjQ5MDJsLS4wMDA0OS0uMDAwNDkuMDAwNDkuMDAwNDljLjI2MzQzLjI0Mzk2LjUyMTg1LjQ4Nzg1Ljc3NTMzLjczMTUxLjA0MTc1LjA0MDE2LjA4MTkxLjA3OTk2LjEyMzM1LjEyMDA2LjE5NjcyLjE5MDMxLjM4OTg5LjM4LjU3OTIyLjU2OTE1LjA3MjAyLjA3MTkuMTQyNjQuMTQzMzEuMjEzNS4yMTQ5Ny4xNTkxMi4xNjEwMS4zMTQ2NC4zMjA5OC40Njc0Ny40ODAzNS4wNzE5Ni4wNzUwMS4xNDQzNS4xNDk5Ni4yMTQ3OC4yMjQ0OS4xNjkzMS4xNzkyNi4zMzMxMy4zNTY4MS40OTMyMy41MzMwOC4wNDI5Ny4wNDczLjA4ODUuMDk1NC4xMzA4LjE0MjUyLjE5MTI4LjIxMzA3LjM3Mzc4LjQyMjc5LjU0OTc0LjYzMDEzLjA2MzM1LjA3NDY1LjEyMjMxLjE0NzM0LjE4MzUzLjIyMTEzLjExNDQ0LjEzNzk0LjIyNjE0LjI3NDYuMzMyODIuNDA5MjQuMDY0MzMuMDgxMjQuMTI2NzEuMTYxNDQuMTg4MTEuMjQxMzMuMTAxNTYuMTMyMTQuMTk3NjkuMjYxNzguMjkwNzcuMzkwMDguMDUwMTEuMDY5MDkuMTAxODcuMTM4OTIuMTQ5NDEuMjA2NzkuNDg5MzguNjk4NjcuODQ0NTQsMS4zMzQwNSwxLjAyMDMyLDEuODcyMTMsMy4wMzk2Nyw5LjMwNDkzLTQuNDIwMSwxMC41NTM3Ny0xMS45NDAzNywxMC45Nzk0M1oiLz48cGF0aCBkPSJNODAuMTU5NTMsMTQzLjMwODU5Yy4wMjk5Ny4wMjg4MS4wNTg5LjA1NzUuMDg4NjguMDg2MjQtLjAyOTg1LS4wMjg4MS0uMDU4NzItLjA1NzQzLS4wODg2OC0uMDg2MjRaIi8+PHBhdGggZD0iTTE0OS43OTI2NSwxMzQuNzk0MTJjLjA4MjQ2LjAyNi4xNjUxLjA1MTIxLjI0NzM4LjA3ODA2LS4wODIzNC0uMDI2OTItLjE2NDkyLS4wNTItLjI0NzM4LS4wNzgwNloiLz48L2c+PC9zdmc+",
  "watermarkX": 0.2208955223880597,
  "watermarkY": 0.322316986496091,
  "watermarkZoom": 5.417999999999999,
  "watermarkLeft": "#b79d58",
  "watermarkRight": "none",
  "watermarkOpacity": 0.4,
  "version": "fullText",
  "manaSymbols": [],
  "infoYear": "2025",
  "margins": true,
  "bottomInfoTranslate": {"x": 0, "y": 0},
  "bottomInfoRotate": 0,
  "bottomInfoZoom": 1,
  "bottomInfoColor": "white",
  "onload": null,
  "hideBottomInfoBorder": false,
  "showsFlavorBar": true,
  "bottomInfo": {
    "midLeft": {"text": "{elemidinfo-set} • {elemidinfo-language}  {savex}{fontbelerenbsc}{fontsize3}{upinline1}￮{savex2}{elemidinfo-artist}", "x": 0.0647, "y": 0.9548, "width": 0.8707, "height": 0.0171, "oneLine": true, "font": "gothammedium", "size": 0.0171, "color": "white", "outlineWidth": 0.003, "name": "midLeft"},
    "topLeft": {"text": "{elemidinfo-rarity} {kerning3}{elemidinfo-number}{kerning0}", "x": 0.0647, "y": 0.9377, "width": 0.8707, "height": 0.0171, "oneLine": true, "font": "gothammedium", "size": 0.0171, "color": "white", "outlineWidth": 0.003, "name": "topLeft"},
    "note": {"text": "{loadx}{elemidinfo-note}", "x": 0.0647, "y": 0.9377, "width": 0.8707, "height": 0.0171, "oneLine": true, "font": "gothammedium", "size": 0.0171, "color": "white", "outlineWidth": 0.003, "name": "note"},
    "bottomLeft": {"text": "NOT FOR SALE", "x": 0.0647, "y": 0.9719, "width": 0.8707, "height": 0.0143, "oneLine": true, "font": "gothammedium", "size": 0.0143, "color": "white", "outlineWidth": 0.003},
    "wizards": {"name": "wizards", "text": "{ptshift0,0.0172}™ & © {elemidinfo-year} Wizards of the Coast", "x": 0.0647, "y": 0.9377, "width": 0.8707, "height": 0.0167, "oneLine": true, "font": "mplantin", "size": 0.0162, "color": "white", "align": "right", "outlineWidth": 0.003},
    "bottomRight": {"text": "{ptshift0,0.0172}CardConjurer.com", "x": 0.0647, "y": 0.9548, "width": 0.8707, "height": 0.0143, "oneLine": true, "font": "mplantin", "size": 0.0143, "color": "white", "align": "right", "outlineWidth": 0.003}
  },
  "artBounds": {"x": -0.044, "y": -0.02857142857142857, "width": 0.044, "height": 0.02857142857142857},
  "setSymbolBounds": {"x": 0.9213, "y": 0.1396, "width": 0.12, "height": 0.041, "vertical": "center", "horizontal": "right"},
  "watermarkBounds": {"x": 0.5, "y": 0.5505, "width": 0.75, "height": 0.4562},
  "text": {
    "mana": {"name": "Mana Cost", "text": "W", "y": 0.0613, "width": 0.9292, "height": 0.03380952380952381, "oneLine": true, "size": 0.043345543345543344, "align": "right", "shadowX": -0.001, "shadowY": 0.0029, "manaCost": true, "manaSpacing": 0},
    "title": {"name": "Title", "text": "Aang", "x": 0.0854, "y": 0.0522, "width": 0.8292, "height": 0.0543, "oneLine": true, "font": "belerenb", "size": 0.0381},
    "rules": {"name": "Rules Text", "text": "{bold}• Creature (8){/bold}\n1 Momo, Rambunctious Rascal {2}{W}\n1 Kindly Customer {1}{W}\n1 Invasion Reinforcements {1}{W}\n1 Water Tribe Captain {2}{W}\n1 Koala-Sheep {2}{W}\n1 Kyoshi Warriors {3}{W}\n1 Aang, Airbending Master {4}{W}\n1 Appa, Loyal Sky Bison {4}{W}{W}\n\n{bold}• Instant (3){/bold}\n1 Cloudshift {W}\n1 Enter the Avatar State {W}\n1 Airbending Lesson {2}{W}\n\n{bold}• Enchantment (1){/bold}\n1 Path to Redemption {1}{W}\n\n{bold}• Land (8){/bold}\n1 Thriving Heath\n7 Plains", "x": 0.086, "y": 0.1157, "width": 0.828, "height": 0.8024, "size": 0.0362},
    "pt": {"name": "Power/Toughness", "text": "", "x": 0.7928, "y": 0.902, "width": 0.1367, "height": 0.0372, "size": 0.0372, "font": "belerenbsc", "oneLine": true, "align": "center"}
  },
  "infoNumber": "F 0001",
  "infoRarity": "",
  "infoSet": "TLA",
  "infoLanguage": "EN",
  "infoArtist": "",
  "infoNote": "",
  "serialNumber": "",
  "serialTotal": "",
  "serialX": "172",
  "serialY": "1383",
  "serialScale": "1",
  "noCorners": true
};

// Utility: Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: HTTPS GET request with redirect support and custom headers
function httpsGet(url, options = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      ...options,
      headers: options.headers || {}
    };

    https.get(url, requestOptions, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        if (maxRedirects > 0 && res.headers.location) {
          return httpsGet(res.headers.location, options, maxRedirects - 1).then(resolve).catch(reject);
        } else {
          return reject(new Error(`Too many redirects or no location header`));
        }
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// Utility: Download image from URL and save to file
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'JumpstartCardGenerator/1.0'
      }
    };

    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        if (res.headers.location) {
          return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
        }
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download image: HTTP ${res.statusCode}`));
      }

      const fileStream = require('fs').createWriteStream(filepath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        require('fs').unlink(filepath, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', reject);
  });
}

// Utility: Get image dimensions using ImageMagick
async function getImageDimensions(filepath) {
  try {
    const { stdout } = await execFileAsync('magick', ['identify', '-format', '%w %h', filepath]);
    const [width, height] = stdout.trim().split(' ').map(Number);
    return { width, height };
  } catch (error) {
    throw new Error(`Failed to get image dimensions: ${error.message}`);
  }
}

// Utility: Calculate bleed width based on card width (matches mpc-bleeder algorithm)
function calculateBleedWidth(cardWidth) {
  // Formula: round((cardWidth * bleedWidth) / widthNoBleed) / 2
  return Math.round((cardWidth * BLEED_WIDTH) / WIDTH_NO_BLEED) / 2;
}

// Utility: Overlay black on original card border to match bleed border shade
async function overlayBlackOnOriginalBorder(filepath, borderWidthPx = 28) {
  try {
    // Get image dimensions
    const { width, height } = await getImageDimensions(filepath);

    // Create temporary output path
    const tempPath = filepath + '.tmp.jpg';

    // Calculate rectangle coordinates for each edge
    // Top edge
    const topRect = `rectangle 0,0 ${width},${borderWidthPx}`;
    // Bottom edge
    const bottomRect = `rectangle 0,${height - borderWidthPx} ${width},${height}`;
    // Left edge
    const leftRect = `rectangle 0,0 ${borderWidthPx},${height}`;
    // Right edge
    const rightRect = `rectangle ${width - borderWidthPx},0 ${width},${height}`;

    // Overlay black rectangles on all four edges using ImageMagick
    await execFileAsync('magick', [
      filepath,
      '-fill', 'black',
      '-draw', topRect,
      '-draw', bottomRect,
      '-draw', leftRect,
      '-draw', rightRect,
      '-quality', '100',
      tempPath
    ]);

    // Replace original with overlay version
    await fs.rename(tempPath, filepath);

    return borderWidthPx;
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(filepath + '.tmp.jpg');
    } catch {}
    throw new Error(`Failed to overlay black border: ${error.message}`);
  }
}

// Utility: Add black border to image using ImageMagick
async function addBlackBorder(filepath) {
  try {
    // Get original dimensions
    const { width } = await getImageDimensions(filepath);

    // Calculate bleed width
    const bleedPx = calculateBleedWidth(width);

    // Create temporary output path
    const tempPath = filepath + '.tmp.jpg';

    // Add black border using ImageMagick
    // -bordercolor black -border NxN adds N pixels of black on each side
    await execFileAsync('magick', [
      filepath,
      '-bordercolor', 'black',
      '-border', `${bleedPx}x${bleedPx}`,
      '-quality', '100',
      tempPath
    ]);

    // Replace original with bordered version
    await fs.rename(tempPath, filepath);

    return bleedPx;
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(filepath + '.tmp.jpg');
    } catch {}
    throw new Error(`Failed to add black border: ${error.message}`);
  }
}

// Rate Limiter Class
class RateLimiter {
  constructor(delayMs = 100) {
    this.delayMs = delayMs;
    this.lastRequestTime = 0;
  }

  async wait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.delayMs) {
      await sleep(this.delayMs - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }
}

// Scryfall Cache Class
class ScryfallCache {
  constructor() {
    this.cardDataCache = new Map();
    this.packCardCache = new Map();
  }

  getCachedCard(cardName, language) {
    const cacheKey = `${language}:${cardName}`;
    return this.cardDataCache.get(cacheKey);
  }

  setCachedCard(cardName, language, data) {
    const cacheKey = `${language}:${cardName}`;
    this.cardDataCache.set(cacheKey, data);
  }

  getCachedPackCard(key, language) {
    const cacheKey = `${language}:${key}`;
    return this.packCardCache.get(cacheKey);
  }

  setCachedPackCard(key, language, themeColor) {
    const cacheKey = `${language}:${key}`;
    this.packCardCache.set(cacheKey, themeColor);
  }
}

// Scryfall API: Query card data
async function queryCardData(cardName, setCode, cache, rateLimiter, language = 'en') {
  // Check cache first
  const cachedData = cache.getCachedCard(cardName, language);
  if (cachedData) {
    return cachedData;
  }

  await rateLimiter.wait();

  const encodedName = encodeURIComponent(cardName);

  // For non-English languages, we need to search for the card and filter by language
  // For English, use the faster /cards/named endpoint
  let url;
  if (language === 'en') {
    url = `https://api.scryfall.com/cards/named?exact=${encodedName}`;
  } else {
    // Search for card with specific language
    // Using quotes for exact name match
    url = `https://api.scryfall.com/cards/search?q=!"${encodedName}"+lang:${language}`;
  }

  const options = {
    headers: {
      'User-Agent': 'JumpstartCardGenerator/1.0',
      'Accept': 'application/json'
    }
  };

  try {
    const response = await httpsGet(url, options);
    const data = JSON.parse(response);

    let card;
    if (language === 'en') {
      card = data;
    } else {
      // For search results, take the first match
      if (data.data && data.data.length > 0) {
        card = data.data[0];
      } else {
        throw new Error('No cards found in search results');
      }
    }

    // Use printed_name if available (localized), otherwise fall back to name
    const localizedName = card.printed_name || card.name;

    const cardData = {
      name: localizedName,
      originalName: card.name, // Keep English name for reference
      mana_cost: card.mana_cost || '',
      type_line: card.type_line || 'Unknown',
      printed_type_line: card.printed_type_line || card.type_line || 'Unknown'
    };

    cache.setCachedCard(cardName, language, cardData);
    return cardData;
  } catch (error) {
    console.log(`[WARN] Card not found in ${language}: ${cardName} (using defaults)`);

    const defaultData = {
      name: cardName,
      originalName: cardName,
      mana_cost: '',
      type_line: 'Unknown',
      printed_type_line: 'Unknown'
    };

    cache.setCachedCard(cardName, language, defaultData);
    return defaultData;
  }
}

// Scryfall API: Query pack card for theme color
async function queryPackCard(packName, faceSet, cache, rateLimiter, language = 'en') {
  const cacheKey = `${faceSet}:${packName}`;

  // Check cache first
  const cachedColor = cache.getCachedPackCard(cacheKey, language);
  if (cachedColor) {
    return cachedColor;
  }

  await rateLimiter.wait();

  // Remove variation indicators for the search
  const cleanPackName = packName.replace(/-\d+$/, '').replace(/\(\d+\)$/, '').trim();
  const searchQuery = encodeURIComponent(`set:${faceSet} ${cleanPackName}`);
  const url = `https://api.scryfall.com/cards/search?q=${searchQuery}`;

  const options = {
    headers: {
      'User-Agent': 'JumpstartCardGenerator/1.0',
      'Accept': 'application/json'
    }
  };

  try {
    const response = await httpsGet(url, options);
    const data = JSON.parse(response);

    if (data.data && data.data.length > 0) {
      const card = data.data[0];
      const oracleText = card.oracle_text || '';
      const collectorNumber = card.collector_number || '';

      let imageUri = card.image_uris?.large || null;

      // For non-English languages, fetch the localized version using set/number/lang
      if (language !== 'en' && collectorNumber) {
        await rateLimiter.wait();
        const localizedUrl = `https://api.scryfall.com/cards/${faceSet.toLowerCase()}/${collectorNumber}/${language}`;

        try {
          const localizedResponse = await httpsGet(localizedUrl, options);
          const localizedCard = JSON.parse(localizedResponse);

          // Use the localized image if available
          if (localizedCard.image_uris?.large) {
            imageUri = localizedCard.image_uris.large;
          }
        } catch (error) {
          console.log(`[WARN] Localized version not found for ${packName} in ${language}, using English version`);
        }
      }

      // Extract color from oracle_text
      const colors = [];
      if (/{W}/.test(oracleText)) colors.push('W');
      if (/{U}/.test(oracleText)) colors.push('U');
      if (/{B}/.test(oracleText)) colors.push('B');
      if (/{R}/.test(oracleText)) colors.push('R');
      if (/{G}/.test(oracleText)) colors.push('G');

      let themeColor;
      if (colors.length === 0) {
        themeColor = '{C}';
      } else if (colors.length === 1) {
        themeColor = `{${colors[0]}}`;
      } else {
        // For multicolor, store all colors in WUBRG order
        themeColor = colors.map(c => `{${c}}`).join('');
      }

      const result = { themeColor, collectorNumber, imageUri };
      cache.setCachedPackCard(cacheKey, language, result);
      return result;
    }
  } catch (error) {
    console.log(`[WARN] Pack card not found for: ${packName} in set ${faceSet}`);
  }

  // Default to colorless if not found
  const result = { themeColor: '{C}', collectorNumber: '', imageUri: null };
  cache.setCachedPackCard(cacheKey, language, result);
  return result;
}

// Parse card quantity
function parseCardQuantity(cardString) {
  const match = cardString.match(/^(\d+)\s+(.+)$/);
  if (match) {
    return {
      quantity: parseInt(match[1], 10),
      name: match[2].trim()
    };
  }
  return {
    quantity: 1,
    name: cardString.trim()
  };
}

// Categorize card by type
function categorizeCardByType(typeLine) {
  if (/Creature/.test(typeLine)) return 'Creature';
  if (/Planeswalker/.test(typeLine)) return 'Planeswalker';
  if (/Instant/.test(typeLine)) return 'Instant';
  if (/Sorcery/.test(typeLine)) return 'Sorcery';
  if (/Artifact/.test(typeLine)) return 'Artifact';
  if (/Enchantment/.test(typeLine)) return 'Enchantment';
  if (/Land/.test(typeLine)) return 'Land';
  // Default unknown cards to Creature category
  return 'Creature';
}

// Generate rules text
function generateRulesText(cardsWithData) {
  const cardsByType = {};

  for (const card of cardsWithData) {
    const type = categorizeCardByType(card.type_line);
    if (!cardsByType[type]) {
      cardsByType[type] = [];
    }
    cardsByType[type].push(card);
  }

  const typeOrder = ['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land'];
  const sections = [];

  for (const type of typeOrder) {
    if (cardsByType[type] && cardsByType[type].length > 0) {
      const cards = cardsByType[type];
      const totalCount = cards.reduce((sum, card) => sum + (card.quantity || 1), 0);

      const sectionLines = [];
      sectionLines.push(`{bold}• ${type} (${totalCount}){/bold}`);

      for (const card of cards) {
        const quantity = card.quantity || 1;
        const manaCost = card.mana_cost ? ` ${card.mana_cost}` : '';
        sectionLines.push(`${quantity} ${card.name}${manaCost}`);
      }

      sections.push(sectionLines.join('\n'));
    }
  }

  return sections.join('\n\n');
}

// Format friendly pack name
function formatFriendlyPackName(packName) {
  // Handle "Adept-(1)" format
  const parenMatch = packName.match(/^(.+)-\((\d+)\)$/);
  if (parenMatch) {
    return `${parenMatch[1].replace(/-/g, ' ')} (${parenMatch[2]})`;
  }

  // Handle "Stalwart-Soldiers-1" format
  const parts = packName.split('-');
  const lastPart = parts[parts.length - 1];

  if (/^\d+$/.test(lastPart)) {
    const nameParts = parts.slice(0, -1);
    return `${nameParts.join(' ')} (${lastPart})`;
  }

  // Handle simple name with dashes
  return packName.replace(/-/g, ' ');
}

// Fetch SVG and convert to base64
async function fetchSVGAsBase64(url) {
  try {
    const svgData = await httpsGet(url);
    const base64 = Buffer.from(svgData).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    console.log(`[ERROR] Failed to fetch watermark from ${url}: ${error.message}`);
    return '';
  }
}

// Parse SVG dimensions from base64 data URI
function parseSVGDimensions(base64DataUri) {
  try {
    // Extract base64 part from data URI
    const base64Data = base64DataUri.replace(/^data:image\/svg\+xml;base64,/, '');
    const svgContent = Buffer.from(base64Data, 'base64').toString('utf-8');

    // Try to extract width and height from SVG tag
    const svgTagMatch = svgContent.match(/<svg[^>]*>/);
    if (!svgTagMatch) {
      return null;
    }

    const svgTag = svgTagMatch[0];

    // Extract width and height attributes
    const widthMatch = svgTag.match(/width=["']([^"']+)["']/);
    const heightMatch = svgTag.match(/height=["']([^"']+)["']/);

    // Check if width/height are explicit values
    if (widthMatch && heightMatch) {
      const widthStr = widthMatch[1];
      const heightStr = heightMatch[1];

      // Check for unit suffixes (mm, cm, in, pt, pc, em, rem, %, etc.)
      const hasUnits = /[a-z%]+$/i.test(widthStr);
      const isPercentage = widthStr.includes('%');
      const isUnitBased = hasUnits && !widthStr.endsWith('px'); // px is considered unitless for our purposes

      // If it's a pure number or ends with 'px', use it directly
      if (!hasUnits || widthStr.endsWith('px')) {
        const width = parseFloat(widthStr);
        const height = parseFloat(heightStr);
        if (!isNaN(width) && !isNaN(height)) {
          return { width, height };
        }
      }
    }

    // If width/height are percentages, unit-based, or missing, use viewBox
    const viewBoxMatch = svgTag.match(/viewBox=["']([^"']+)["']/);
    if (viewBoxMatch) {
      const viewBoxParts = viewBoxMatch[1].trim().split(/\s+/);
      if (viewBoxParts.length === 4) {
        const vbWidth = parseFloat(viewBoxParts[2]);
        const vbHeight = parseFloat(viewBoxParts[3]);

        // Check if the original dimensions had mm units (indicates small viewBox in mm coordinates)
        const hasMMUnits = widthMatch && widthMatch[1].includes('mm');

        // Determine scale factor based on viewBox magnitude and units
        let scaleFactor = 1.0;
        if (hasMMUnits) {
          // Convert mm to pixels (96 DPI: 1mm = 96/25.4 ≈ 3.7795 pixels)
          scaleFactor = 96 / 25.4;
        } else if (vbWidth > 500 || vbHeight > 500) {
          // Very large viewBoxes (>500) like J25's "1000 1000" - scale to ~150px
          const maxDim = Math.max(vbWidth, vbHeight);
          scaleFactor = 150 / maxDim;
        } else if (vbWidth > 100 || vbHeight > 100) {
          // Moderately large viewBoxes (100-500) - scale to maintain reasonable size
          scaleFactor = 0.15;
        }

        return {
          width: vbWidth * scaleFactor,
          height: vbHeight * scaleFactor
        };
      }
    }

    return null;
  } catch (error) {
    console.log(`[WARN] Failed to parse SVG dimensions: ${error.message}`);
    return null;
  }
}

// Calculate watermark position using CardConjurer's algorithm
function calculateWatermarkPosition(watermarkDimensions, cardTemplate) {
  const cardWidth = cardTemplate.width;
  const cardHeight = cardTemplate.height;
  const marginX = cardTemplate.marginX || 0;
  const marginY = cardTemplate.marginY || 0;
  const bounds = cardTemplate.watermarkBounds;

  // Scale functions (convert normalized 0-1 values to pixels)
  const scaleWidth = (value) => value * cardWidth;
  const scaleHeight = (value) => value * cardHeight;
  const scaleX = (value) => value * cardWidth;
  const scaleY = (value) => value * cardHeight;

  // Calculate watermark zoom based on aspect ratio fit
  // Zoom is stored as a factor, not a percentage
  let watermarkZoom;
  const watermarkAspect = watermarkDimensions.width / watermarkDimensions.height;
  const boundsAspect = scaleWidth(bounds.width) / scaleHeight(bounds.height);

  if (watermarkAspect > boundsAspect) {
    // Fit to width
    watermarkZoom = parseFloat((scaleWidth(bounds.width) / watermarkDimensions.width).toFixed(2));
  } else {
    // Fit to height
    watermarkZoom = parseFloat((scaleHeight(bounds.height) / watermarkDimensions.height).toFixed(2));
  }

  // Calculate x and y positions in pixels
  const watermarkXPixels = Math.round(
    scaleX(bounds.x) -
    watermarkDimensions.width * watermarkZoom / 2 -
    scaleWidth(marginX)
  );

  const watermarkYPixels = Math.round(
    scaleY(bounds.y) -
    watermarkDimensions.height * watermarkZoom / 2 -
    scaleHeight(marginY)
  );

  // Normalize to 0-1 range
  const watermarkX = watermarkXPixels / cardWidth;
  const watermarkY = watermarkYPixels / cardHeight;

  return {
    watermarkX,
    watermarkY,
    watermarkZoom
  };
}

// Calculate set symbol zoom (X/Y positions use template values due to frame alignment)
function calculateSetSymbolZoom(setSymbolDimensions, cardTemplate) {
  const bounds = cardTemplate.setSymbolBounds;

  // Scale functions (convert normalized 0-1 values to pixels)
  const scaleWidth = (value) => value * cardTemplate.width;
  const scaleHeight = (value) => value * cardTemplate.height;

  // Calculate set symbol zoom based on aspect ratio fit
  // Zoom is stored as a factor, not a percentage
  let setSymbolZoom;
  const setSymbolAspect = setSymbolDimensions.width / setSymbolDimensions.height;
  const boundsAspect = scaleWidth(bounds.width) / scaleHeight(bounds.height);

  if (setSymbolAspect > boundsAspect) {
    // Fit to width
    setSymbolZoom = parseFloat((scaleWidth(bounds.width) / setSymbolDimensions.width).toFixed(2));
  } else {
    // Fit to height
    setSymbolZoom = parseFloat((scaleHeight(bounds.height) / setSymbolDimensions.height).toFixed(2));
  }

  return setSymbolZoom;
}

// Cache watermarks for a set
async function cacheWatermarks(setConfig) {
  console.log('[INFO] Fetching watermarks...');

  const backgroundWatermark = await fetchSVGAsBase64(setConfig['background-watermark']);
  const lowerWatermark = await fetchSVGAsBase64(setConfig['lower-watermark']);

  // Parse watermark dimensions for position calculation
  const watermarkDimensions = parseSVGDimensions(backgroundWatermark);
  if (watermarkDimensions) {
    console.log(`[INFO] Watermark dimensions: ${watermarkDimensions.width}x${watermarkDimensions.height}`);
  }

  // Parse set symbol dimensions for position calculation
  const setSymbolDimensions = parseSVGDimensions(lowerWatermark);
  if (setSymbolDimensions) {
    console.log(`[INFO] Set symbol dimensions: ${setSymbolDimensions.width}x${setSymbolDimensions.height}`);
  }

  return {
    backgroundWatermark,
    lowerWatermark,
    watermarkDimensions,
    setSymbolDimensions
  };
}

// Generate collector number
function generateCollectorNumber(index) {
  return `F ${String(index + 1).padStart(4, '0')}`;
}

// Generate output filename
function generateOutputFilename(setCode, collectorNumber, packName) {
  // Pad collector number with zeros if it's purely numeric
  let numberPart = collectorNumber;
  if (/^\d+$/.test(collectorNumber)) {
    numberPart = collectorNumber.padStart(4, '0');
  }

  // Convert pack name for filename
  const filenamePart = packName
    .replace(/\s*\((\d+)\)$/, '-$1')
    .replace(/\s+/g, '-');

  return `${setCode}-${numberPart}-${filenamePart}.json`;
}

// Generate pack JSON
function generatePackJSON(template, packData, setConfig, watermarks, collectorNumber, language = 'en') {
  const output = JSON.parse(JSON.stringify(template));

  // Determine if multicolor (has multiple color symbols) or colorless
  const colorCount = (packData.themeColor.match(/\{/g) || []).length;
  const isMulticolor = colorCount > 1;
  const isColorless = packData.themeColor === '{C}';

  // Update frame based on theme color (frames[1] is the color frame, frames[0] is the Black Extension)
  // Colorless cards use multicolor frame since there is no colorless frame
  let frame;
  if (isMulticolor || isColorless) {
    frame = COLOR_TO_FRAME_MAP['multicolor'];
  } else {
    frame = COLOR_TO_FRAME_MAP[packData.themeColor];
  }
  output.frames[1].name = frame.name;
  output.frames[1].src = frame.src;

  // Update mana cost text based on theme color
  // For single color: "{W}" -> "W"
  // For multicolor: "{W}{U}{B}" -> "{W}{U}{B}"
  let manaText = '';
  if (isMulticolor) {
    // Keep the full color string for multicolor (e.g., "{W}{U}{B}")
    manaText = packData.themeColor;
  } else {
    // Extract single letter from "{X}" format
    const match = packData.themeColor.match(/\{(.)\}/);
    if (match) {
      manaText = match[1];
    }
  }
  output.text.mana.text = manaText;

  // Update watermarks
  output.watermarkSource = watermarks.backgroundWatermark;
  output.setSymbolSource = watermarks.lowerWatermark;

  // Update watermark color based on theme color
  // Colorless cards use multicolor watermark since there is no colorless frame
  let watermarkColor;
  if (isMulticolor || isColorless) {
    watermarkColor = COLOR_TO_WATERMARK_MAP['multicolor'];
  } else {
    watermarkColor = COLOR_TO_WATERMARK_MAP[packData.themeColor];
  }
  output.watermarkLeft = watermarkColor;

  // Calculate and update watermark position if dimensions are available
  if (watermarks.watermarkDimensions) {
    const position = calculateWatermarkPosition(watermarks.watermarkDimensions, template);
    output.watermarkX = position.watermarkX;
    output.watermarkY = position.watermarkY;
    output.watermarkZoom = position.watermarkZoom;

    // Special adjustment for J25's square watermark to better match other sets
    if (setConfig.set === 'J25') {
      output.watermarkX += 0.04; // Shift right by 4% to match TLA positioning
      output.watermarkZoom *= 0.85; // Reduce zoom by 15% to make it smaller
    }
  }

  // Calculate and update set symbol zoom if dimensions are available
  // (X/Y positions use template defaults due to frame-specific alignment)
  if (watermarks.setSymbolDimensions) {
    output.setSymbolZoom = calculateSetSymbolZoom(watermarks.setSymbolDimensions, template);
  }

  // Update set info
  output.infoSet = setConfig.set;

  // Update language info (convert to uppercase: en -> EN, es -> ES, etc.)
  output.infoLanguage = language.toUpperCase();

  // Update collector number (format as "F 0001", padded to 4 digits)
  let paddedNumber = collectorNumber;
  if (/^\d+$/.test(collectorNumber)) {
    paddedNumber = collectorNumber.padStart(4, '0');
  }
  output.infoNumber = `F ${paddedNumber}`;

  // Update rules text
  output.text.rules.text = packData.rulesText;

  // Update title
  output.text.title.text = packData.friendlyName;

  return output;
}

// Main processing function
async function main() {
  // Parse CLI arguments
  const setCode = process.argv[2];
  const cliLanguage = process.argv[3];

  if (!setCode) {
    console.log('[FATAL] Usage: node generate-card-conjurer-json.js <SET_CODE> [LANGUAGE]');
    console.log('[FATAL] Example: node generate-card-conjurer-json.js TLA es');
    console.log(`[FATAL] Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  // Determine language: CLI arg > env variable > default
  let language = cliLanguage || process.env.JUMPSTART_LANGUAGE || DEFAULT_LANGUAGE;
  language = language.toLowerCase();

  // Validate language
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    console.log(`[FATAL] Unsupported language: ${language}`);
    console.log(`[FATAL] Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  console.log(`[INFO] Processing set: ${setCode}`);
  console.log(`[INFO] Language: ${language}`);

  // Load configuration files
  const setsJsonPath = path.join(__dirname, 'sets.json');

  let setsConfig, packs;

  try {
    const setsJsonContent = await fs.readFile(setsJsonPath, 'utf-8');
    setsConfig = JSON.parse(setsJsonContent);
  } catch (error) {
    console.log(`[FATAL] Failed to load sets.json: ${error.message}`);
    process.exit(1);
  }

  // Find set configuration
  const setConfig = setsConfig.find(s => s.set === setCode);
  if (!setConfig) {
    console.log(`[FATAL] Set configuration not found for: ${setCode}`);
    const availableSets = [...new Set(setsConfig.map(s => s.set))];
    console.log('[FATAL] Valid set codes:', availableSets.join(', '));
    process.exit(1);
  }

  // Validate intermediate JSON is specified
  if (!setConfig['intermediate-json']) {
    console.log(`[FATAL] No intermediate-json specified for set: ${setCode}`);
    process.exit(1);
  }

  const intermediateFile = setConfig['intermediate-json'];
  const intermediatePath = path.join(__dirname, 'output', 'json-decklists', intermediateFile);

  // Use embedded template
  const template = CARD_TEMPLATE;

  try {
    const packsContent = await fs.readFile(intermediatePath, 'utf-8');
    packs = JSON.parse(packsContent);
  } catch (error) {
    console.log(`[FATAL] Failed to load intermediate JSON ${intermediateFile}: ${error.message}`);
    process.exit(1);
  }

  // Initialize rate limiter and cache
  const rateLimiter = new RateLimiter(SCRYFALL_DELAY_MS);
  const cache = new ScryfallCache();

  // Fetch watermarks
  const watermarks = await cacheWatermarks(setConfig);

  // Create cardconjurer JSON files directory
  const outputDir = path.join(__dirname, 'output', 'cardconjurer-json-files');
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.log(`[ERROR] Failed to create output directory: ${error.message}`);
  }

  // Create front images directory
  const imagesDir = path.join(__dirname, 'output', 'front-images');
  try {
    await fs.mkdir(imagesDir, { recursive: true });
  } catch (error) {
    console.log(`[ERROR] Failed to create images directory: ${error.message}`);
  }

  // Statistics
  let successCount = 0;
  let failureCount = 0;
  let cardsProcessed = 0;
  let cardsNotFound = 0;

  // Array to collect all generated cards for combined file
  const allCards = [];

  console.log(`[INFO] Processing ${packs.length} packs...`);

  // Process each pack
  for (let i = 0; i < packs.length; i++) {
    const pack = packs[i];
    const packName = pack.name;

    console.log(`[INFO] Processing pack ${i + 1}/${packs.length}: ${packName}`);

    try {
      // Parse card quantities
      const parsedCards = pack.cards.map(parseCardQuantity);

      // Query Scryfall for each card
      const cardsWithData = [];
      for (const parsedCard of parsedCards) {
        const cardData = await queryCardData(parsedCard.name, setConfig.set, cache, rateLimiter, language);
        cardsProcessed++;

        if (cardData.type_line === 'Unknown') {
          cardsNotFound++;
        }

        cardsWithData.push({
          ...cardData,
          quantity: parsedCard.quantity
        });
      }

      // Query pack card for theme color and collector number
      const packCardData = await queryPackCard(packName, setConfig['face-set'], cache, rateLimiter, language);
      const themeColor = packCardData.themeColor;
      const collectorNumber = packCardData.collectorNumber;
      const imageUri = packCardData.imageUri;

      // Download face card image if available
      if (imageUri) {
        try {
          // Generate image filename (e.g., TLA-0001-Aang.jpg)
          const imageFilename = generateOutputFilename(setCode, collectorNumber, formatFriendlyPackName(packName)).replace('.json', '.jpg');
          const imagePath = path.join(imagesDir, imageFilename);

          await downloadImage(imageUri, imagePath);
          console.log(`[INFO] Downloaded image: ${imageFilename}`);

          // Overlay black on original border to match bleed border shade
          const overlayPx = await overlayBlackOnOriginalBorder(imagePath, 28);
          console.log(`[INFO] Overlaid ${overlayPx}px black on original border: ${imageFilename}`);

          // Add black border for MPC printing
          const bleedPx = await addBlackBorder(imagePath);
          console.log(`[INFO] Added ${bleedPx}px black bleed border to: ${imageFilename}`);
        } catch (error) {
          console.log(`[WARN] Failed to download/process image for ${packName}: ${error.message}`);
        }
      } else {
        console.log(`[WARN] No image URI found for pack card: ${packName}`);
      }

      // Generate rules text
      const rulesText = generateRulesText(cardsWithData);

      // Format friendly pack name
      const friendlyName = formatFriendlyPackName(packName);

      // Prepare pack data
      const packData = {
        themeColor,
        rulesText,
        friendlyName
      };

      // Generate pack JSON
      const packJSON = generatePackJSON(template, packData, setConfig, watermarks, collectorNumber, language);

      // Write output file
      const filename = generateOutputFilename(setCode, collectorNumber, friendlyName);
      const outputPath = path.join(outputDir, filename);
      const prettyJSON = JSON.stringify(packJSON, null, 2);

      await fs.writeFile(outputPath, prettyJSON, 'utf-8');

      // Use friendly name as key (includes variation numbers like "(1)", "(2)", etc.)
      const keyName = friendlyName;

      // Add to combined cards array
      allCards.push({
        key: keyName,
        data: packJSON
      });

      successCount++;
    } catch (error) {
      console.log(`[ERROR] Failed to process pack ${packName}: ${error.message}`);
      failureCount++;
    }
  }

  // Generate combined .cardconjurer file
  console.log(`\n[INFO] Generating combined card file...`);
  try {
    // Create cardconjurer import files directory
    const importFilesDir = path.join(__dirname, 'output', 'cardconjurer-import-files');
    await fs.mkdir(importFilesDir, { recursive: true });

    const combinedFilename = `${setCode}-saved-cards.cardconjurer`;
    const combinedPath = path.join(importFilesDir, combinedFilename);
    const combinedJSON = JSON.stringify(allCards, null, 2);

    await fs.writeFile(combinedPath, combinedJSON, 'utf-8');
    console.log(`[INFO] Combined file saved: ${combinedFilename}`);
  } catch (error) {
    console.log(`[ERROR] Failed to write combined file: ${error.message}`);
  }

  // Print summary report
  console.log('\n=====================================');
  console.log('Summary Report');
  console.log('=====================================');
  console.log(`Total Packs: ${packs.length}`);
  console.log(`Successfully Generated: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log('');
  console.log(`Cards Processed: ${cardsProcessed}`);
  console.log(`Cards Not Found: ${cardsNotFound}`);
  console.log('');
  console.log(`Output Directory: ${outputDir}`);
  console.log('=====================================');
}

// Run main function
main().catch(error => {
  console.log(`[FATAL] Unhandled error: ${error.message}`);
  process.exit(1);
});
