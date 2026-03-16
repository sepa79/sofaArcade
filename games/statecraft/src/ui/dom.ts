import { MAX_ACTIVE_CONTRACTS } from '../game/constants';
import type { BudgetKey, GameState, SpeedSetting, TileState } from '../game/types';

export interface UiHandlers {
  readonly onBudgetChange: (key: BudgetKey, value: number) => void;
  readonly onAction: (action:
    | 'survey_tile'
    | 'build_rig'
    | 'repair_rig'
    | 'import_unit'
    | 'sign_contract'
    | 'sell_spot'
    | 'buy_gold'
    | 'sell_gold') => void;
  readonly onPauseToggle: () => void;
  readonly onSpeedChange: (speed: SpeedSetting) => void;
}

export interface UiController {
  render(state: GameState): void;
  destroy(): void;
}

export interface UiMountOptions {
  readonly mode: 'standalone' | 'overlay';
}

function requireElement<T extends Element>(parent: ParentNode, selector: string): T {
  const element = parent.querySelector(selector);
  if (!(element instanceof Element)) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element as T;
}

function formatRank(rank: number): string {
  switch (rank) {
    case 0:
      return 'Disaster';
    case 1:
      return 'Strongman';
    case 2:
      return 'Competent';
    case 3:
      return 'Legend';
    default:
      throw new Error(`Unknown rank band: ${rank}`);
  }
}

function formatCause(cause: GameState['run']['cause']): string {
  switch (cause) {
    case null:
      return 'Running';
    case 'bankruptcy':
      return 'Bankruptcy';
    case 'election':
      return 'Election Loss';
    case 'support':
      return 'Support Collapse';
    case 'disease':
      return 'Disease Collapse';
  }
}

function requireSelectedTile(state: GameState): TileState | null {
  if (state.map.selectedTileId === null) {
    return null;
  }

  const tile = state.map.tiles.find((candidate) => candidate.id === state.map.selectedTileId);
  if (tile === undefined) {
    throw new Error(`Selected tile ${state.map.selectedTileId} not found in UI render.`);
  }

  return tile;
}

function formatSelectedTile(tile: TileState | null): string {
  if (tile === null) {
    return 'No sector selected.';
  }

  const status =
    tile.damaged ? 'Damaged rig' :
    tile.rigLevel > 0 ? `Rig x${tile.rigLevel}` :
    tile.surveyed ? 'Surveyed reserve' :
    'Unsurveyed';

  return `Sector ${tile.id + 1} • ${status} • Richness ${tile.richness.toFixed(2)}`;
}

function briefingText(state: GameState, tile: TileState | null): string {
  if (state.run.gameOver) {
    return 'Run is over. Review the feed, then restart from the launcher.';
  }

  if (tile === null) {
    return 'Click a sector on the map. Survey unknown sectors first, then build rigs on the best ones.';
  }

  if (!tile.surveyed) {
    return 'Survey this sector to reveal it. Survey is the safest first move when you are learning the loop.';
  }

  if (tile.damaged) {
    return 'Repair this rig first. Damaged wells cut oil output and starve your monthly income.';
  }

  if (tile.rigLevel === 0) {
    return 'Build a rig here to increase oil capacity. More oil makes contracts and spot sales meaningful.';
  }

  if (state.markets.activeContracts.length === 0) {
    return 'You have production online. Sign a contract or sell spot oil before month end to bring money in.';
  }

  if (state.resources.foodSupply < state.resources.foodDemand) {
    return 'Food is below demand. Push the Food slider up before support starts slipping harder.';
  }

  if (state.resources.diseaseRisk > 40) {
    return 'Disease risk is rising. Raise Health spending before it drags support down.';
  }

  return 'Keep treasury positive, support above collapse, and survive until the next election.';
}

function renderUiMarkup(mode: UiMountOptions['mode']): string {
  const shellClass =
    mode === 'standalone'
      ? 'statecraft-shell statecraft-shell-standalone'
      : 'statecraft-shell statecraft-shell-overlay';

  if (mode === 'standalone') {
    return `
      <div class="${shellClass}">
        <div class="statecraft-stage-frame">
          <div id="statecraft-stage"></div>
        </div>
        <div class="statecraft-overlay">
          <section class="panel panel-top">
            <div class="stat"><span>Treasury</span><strong data-field="treasury"></strong></div>
            <div class="stat"><span>Net</span><strong data-field="net"></strong></div>
            <div class="stat"><span>Month</span><strong data-field="month"></strong></div>
            <div class="stat"><span>Election</span><strong data-field="election"></strong></div>
            <div class="stat"><span>Score</span><strong data-field="score"></strong></div>
            <div class="stat"><span>Status</span><strong data-field="status"></strong></div>
          </section>
          <section class="panel panel-time">
            <div class="card-label">Time</div>
            <div class="speed-row speed-row-top">
              <button data-speed="0">Pause</button>
              <button data-speed="1">1x</button>
              <button data-speed="2">2x</button>
              <button data-speed="4">4x</button>
            </div>
            <div class="mini-note" data-field="time-state"></div>
          </section>
          <section class="panel panel-left">
            <h2>Cabinet</h2>
            <div class="briefing-card">
              <div class="card-label">Next Step</div>
              <div class="briefing-copy" data-field="briefing"></div>
            </div>
            <div class="selected-card">
              <div class="card-label">Selected Sector</div>
              <div class="selected-copy" data-field="selected-sector"></div>
            </div>
            <h3>Policy Mix</h3>
            <label>Food <input data-budget="foodPct" type="range" min="0" max="100" step="1" /></label>
            <label>Health <input data-budget="healthPct" type="range" min="0" max="100" step="1" /></label>
            <label>Oil <input data-budget="oilPct" type="range" min="0" max="100" step="1" /></label>
            <label>Security <input data-budget="securityPct" type="range" min="0" max="100" step="1" /></label>
            <div class="budget-readout" data-field="budget-readout"></div>
            <div class="mini-note">Budget always totals 100%. One month settles every 4 weeks.</div>
          </section>
          <section class="panel panel-right">
            <h2>Orders</h2>
            <div class="action-group-label">Infrastructure</div>
            <button data-action="survey_tile">Survey Sector</button>
            <button data-action="build_rig">Build Rig</button>
            <button data-action="repair_rig">Repair Rig</button>
            <div class="action-group-label">Trade</div>
            <button data-action="sign_contract">Sign Contract</button>
            <button data-action="sell_spot">Sell Spot Oil</button>
            <button data-action="buy_gold">Buy Gold</button>
            <button data-action="sell_gold">Sell Gold</button>
            <div class="action-group-label">Security</div>
            <button data-action="import_unit">Import Unit</button>
          </section>
          <section class="panel panel-bottom">
            <div class="support-bars">
              <div class="bar-group">
                <span>Your Bloc</span>
                <div class="bar"><div data-bar="yourBloc"></div></div>
              </div>
              <div class="bar-group">
                <span>Moderates</span>
                <div class="bar"><div data-bar="moderates"></div></div>
              </div>
              <div class="bar-group">
                <span>Extremists</span>
                <div class="bar"><div data-bar="extremists"></div></div>
              </div>
            </div>
            <div class="resource-strip">
              <span data-field="food"></span>
              <span data-field="disease"></span>
              <span data-field="oil"></span>
              <span data-field="gold"></span>
              <span data-field="rank"></span>
            </div>
            <ul class="event-feed" data-field="events"></ul>
          </section>
        </div>
      </div>
    `;
  }

  return `
    <div class="${shellClass}">
      <div class="statecraft-overlay">
        <section class="panel panel-top">
          <div class="stat"><span>Treasury</span><strong data-field="treasury"></strong></div>
          <div class="stat"><span>Net</span><strong data-field="net"></strong></div>
          <div class="stat"><span>Month</span><strong data-field="month"></strong></div>
          <div class="stat"><span>Election</span><strong data-field="election"></strong></div>
          <div class="stat"><span>Score</span><strong data-field="score"></strong></div>
          <div class="stat"><span>Status</span><strong data-field="status"></strong></div>
        </section>
        <section class="panel panel-time">
          <div class="card-label">Time</div>
          <div class="speed-row speed-row-top">
            <button data-speed="0">Pause</button>
            <button data-speed="1">1x</button>
            <button data-speed="2">2x</button>
            <button data-speed="4">4x</button>
          </div>
          <div class="mini-note" data-field="time-state"></div>
        </section>
        <section class="panel panel-left">
          <h2>Cabinet</h2>
          <div class="briefing-card">
            <div class="card-label">Next Step</div>
            <div class="briefing-copy" data-field="briefing"></div>
          </div>
          <div class="selected-card">
            <div class="card-label">Selected Sector</div>
            <div class="selected-copy" data-field="selected-sector"></div>
          </div>
          <h3>Policy Mix</h3>
          <label>Food <input data-budget="foodPct" type="range" min="0" max="100" step="1" /></label>
          <label>Health <input data-budget="healthPct" type="range" min="0" max="100" step="1" /></label>
          <label>Oil <input data-budget="oilPct" type="range" min="0" max="100" step="1" /></label>
          <label>Security <input data-budget="securityPct" type="range" min="0" max="100" step="1" /></label>
          <div class="budget-readout" data-field="budget-readout"></div>
          <div class="mini-note">Budget always totals 100%. One month settles every 4 weeks.</div>
        </section>
        <section class="panel panel-right">
          <h2>Orders</h2>
          <div class="action-group-label">Infrastructure</div>
          <button data-action="survey_tile">Survey Sector</button>
          <button data-action="build_rig">Build Rig</button>
          <button data-action="repair_rig">Repair Rig</button>
          <div class="action-group-label">Trade</div>
          <button data-action="sign_contract">Sign Contract</button>
          <button data-action="sell_spot">Sell Spot Oil</button>
          <button data-action="buy_gold">Buy Gold</button>
          <button data-action="sell_gold">Sell Gold</button>
          <div class="action-group-label">Security</div>
          <button data-action="import_unit">Import Unit</button>
        </section>
        <section class="panel panel-bottom">
          <div class="support-bars">
            <div class="bar-group">
              <span>Your Bloc</span>
              <div class="bar"><div data-bar="yourBloc"></div></div>
            </div>
            <div class="bar-group">
              <span>Moderates</span>
              <div class="bar"><div data-bar="moderates"></div></div>
            </div>
            <div class="bar-group">
              <span>Extremists</span>
              <div class="bar"><div data-bar="extremists"></div></div>
            </div>
          </div>
          <div class="resource-strip">
            <span data-field="food"></span>
            <span data-field="disease"></span>
            <span data-field="oil"></span>
            <span data-field="gold"></span>
            <span data-field="rank"></span>
          </div>
          <ul class="event-feed" data-field="events"></ul>
        </section>
      </div>
    </div>
  `;
}

export function createUiController(
  root: HTMLElement,
  handlers: UiHandlers,
  options: UiMountOptions = { mode: 'standalone' }
): UiController {
  root.innerHTML = renderUiMarkup(options.mode);

  const budgetInputs = new Map<BudgetKey, HTMLInputElement>();
  for (const key of ['foodPct', 'healthPct', 'oilPct', 'securityPct'] as const) {
    const input = requireElement<HTMLInputElement>(root, `input[data-budget="${key}"]`);
    budgetInputs.set(key, input);
    input.addEventListener('input', () => {
      handlers.onBudgetChange(key, Number(input.value));
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
    const actionName = button.dataset.action;
    if (actionName === undefined) {
      throw new Error('Action button is missing data-action.');
    }

    if (actionName === 'pause') {
      button.addEventListener('click', () => {
        handlers.onPauseToggle();
      });
      continue;
    }

    button.addEventListener('click', () => {
      handlers.onAction(
        actionName as
          | 'survey_tile'
          | 'build_rig'
          | 'repair_rig'
          | 'import_unit'
          | 'sign_contract'
          | 'sell_spot'
          | 'buy_gold'
          | 'sell_gold'
      );
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-speed]')) {
    const rawValue = button.dataset.speed;
    if (rawValue === undefined) {
      throw new Error('Speed button is missing data-speed.');
    }

    const speed = Number(rawValue) as SpeedSetting;
    button.addEventListener('click', () => {
      handlers.onSpeedChange(speed);
    });
  }

  const treasuryField = requireElement<HTMLElement>(root, '[data-field="treasury"]');
  const netField = requireElement<HTMLElement>(root, '[data-field="net"]');
  const monthField = requireElement<HTMLElement>(root, '[data-field="month"]');
  const electionField = requireElement<HTMLElement>(root, '[data-field="election"]');
  const scoreField = requireElement<HTMLElement>(root, '[data-field="score"]');
  const statusField = requireElement<HTMLElement>(root, '[data-field="status"]');
  const timeStateField = requireElement<HTMLElement>(root, '[data-field="time-state"]');
  const budgetReadoutField = requireElement<HTMLElement>(root, '[data-field="budget-readout"]');
  const briefingField = requireElement<HTMLElement>(root, '[data-field="briefing"]');
  const selectedSectorField = requireElement<HTMLElement>(root, '[data-field="selected-sector"]');
  const foodField = requireElement<HTMLElement>(root, '[data-field="food"]');
  const diseaseField = requireElement<HTMLElement>(root, '[data-field="disease"]');
  const oilField = requireElement<HTMLElement>(root, '[data-field="oil"]');
  const goldField = requireElement<HTMLElement>(root, '[data-field="gold"]');
  const rankField = requireElement<HTMLElement>(root, '[data-field="rank"]');
  const eventsField = requireElement<HTMLUListElement>(root, '[data-field="events"]');
  const surveyButton = requireElement<HTMLButtonElement>(root, 'button[data-action="survey_tile"]');
  const buildButton = requireElement<HTMLButtonElement>(root, 'button[data-action="build_rig"]');
  const repairButton = requireElement<HTMLButtonElement>(root, 'button[data-action="repair_rig"]');
  const signContractButton = requireElement<HTMLButtonElement>(root, 'button[data-action="sign_contract"]');
  const sellSpotButton = requireElement<HTMLButtonElement>(root, 'button[data-action="sell_spot"]');
  const buyGoldButton = requireElement<HTMLButtonElement>(root, 'button[data-action="buy_gold"]');
  const sellGoldButton = requireElement<HTMLButtonElement>(root, 'button[data-action="sell_gold"]');
  const speedButtons = new Map<SpeedSetting, HTMLButtonElement>();
  for (const speed of [0, 1, 2, 4] as const) {
    speedButtons.set(speed, requireElement<HTMLButtonElement>(root, `button[data-speed="${speed}"]`));
  }

  const yourBlocBar = requireElement<HTMLElement>(root, '[data-bar="yourBloc"]');
  const moderatesBar = requireElement<HTMLElement>(root, '[data-bar="moderates"]');
  const extremistsBar = requireElement<HTMLElement>(root, '[data-bar="extremists"]');

  return {
    render(state) {
      const selectedTile = requireSelectedTile(state);

      for (const [key, input] of budgetInputs) {
        input.value = String(state.budget[key]);
      }

      treasuryField.textContent = `${Math.floor(state.economy.treasury)}`;
      netField.textContent = `${Math.floor(state.economy.monthlyNet)}`;
      monthField.textContent = `Y${state.time.year} M${state.time.month} W${state.time.week}`;
      electionField.textContent = `${state.politics.electionCountdownMonths}m`;
      scoreField.textContent = `${state.score.currentScore}`;
      statusField.textContent = formatCause(state.run.cause);
      timeStateField.textContent = state.time.paused ? 'Time paused.' : `Running at ${state.time.speed}x speed.`;
      briefingField.textContent = briefingText(state, selectedTile);
      selectedSectorField.textContent = formatSelectedTile(selectedTile);
      budgetReadoutField.textContent =
        `Food ${state.budget.foodPct} / Health ${state.budget.healthPct} / Oil ${state.budget.oilPct} / Security ${state.budget.securityPct}`;

      foodField.textContent = `Food ${state.resources.foodSupply.toFixed(0)} / ${state.resources.foodDemand.toFixed(0)}`;
      diseaseField.textContent = `Disease ${state.resources.diseaseRisk.toFixed(0)}`;
      oilField.textContent = `Oil ${state.resources.oilOutput.toFixed(0)} / ${state.resources.oilCapacity.toFixed(0)}`;
      goldField.textContent = `Gold ${state.resources.goldBars} @ ${state.resources.goldPrice}`;
      rankField.textContent = `Rank ${formatRank(state.score.finalRankBand)}`;

      yourBlocBar.style.width = `${state.politics.yourBloc}%`;
      moderatesBar.style.width = `${state.politics.moderates}%`;
      extremistsBar.style.width = `${state.politics.extremists}%`;

      surveyButton.disabled = selectedTile === null || selectedTile.surveyed;
      buildButton.disabled = selectedTile === null || !selectedTile.surveyed || selectedTile.rigLevel > 0;
      repairButton.disabled = selectedTile === null || !selectedTile.damaged;
      signContractButton.disabled = state.markets.activeContracts.length >= MAX_ACTIVE_CONTRACTS;
      sellSpotButton.disabled = state.resources.oilOutput < 4;
      buyGoldButton.disabled = state.economy.treasury < state.resources.goldPrice;
      sellGoldButton.disabled = state.resources.goldBars === 0;
      for (const [speed, button] of speedButtons) {
        button.classList.toggle('is-active', state.time.paused ? speed === 0 : speed === state.time.speed);
      }

      eventsField.innerHTML = state.events
        .map((entry) => `<li>${entry.text}</li>`)
        .join('');
    },
    destroy() {
      if (options.mode === 'overlay') {
        root.remove();
        return;
      }

      root.innerHTML = '';
    }
  };
}
