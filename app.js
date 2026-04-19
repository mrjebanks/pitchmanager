const APP_VERSION = "V1.2";
const INDEXED_DB_NAME = "gljfc-pitch-manager";
const INDEXED_DB_VERSION = 1;
const INDEXED_DB_STORE = "appState";
const INDEXED_DB_RECORD_KEY = "current";
const LEGACY_LOCAL_STORAGE_KEYS = ["gljfc-pitch-manager-v1_1", "gljfc-pitch-manager-v1"];
const WINTER_TRAINING_COLLAPSED_KEY = "gljfc-winter-training-collapsed";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WINTER_TRAINING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const WINTER_TRAINING_TIMES = ["18:00", "19:00", "20:00"];
const TIMELINE_PIXELS_PER_HOUR = 88;
const LEAGUE_KICKOFF_MIN_MINUTES = 9 * 60 + 30;
const KICKOFF_SUGGESTION_MAX_MINUTES = 18 * 60;
const FRIENDLY_DAY_START_MINUTES = 8 * 60;
const FRIENDLY_DAY_END_MINUTES = 22 * 60;
const FRIENDLY_DAY_SLOT_MINUTES = 30;
const REMOTE_STATE_RECORD_ID = "current";
const TAB_DEFINITIONS = [
  { id: "settings", label: "Settings" },
  { id: "teams", label: "Teams" },
  { id: "venues", label: "Venues" },
  { id: "facilities", label: "League Slots" },
  { id: "friendlies", label: "Friendlies" },
  { id: "assignments", label: "Match Plan" },
  { id: "visual", label: "Match Visual" },
  { id: "training", label: "Training" },
  { id: "users", label: "Users" },
];
const USER_MANAGED_TABS = TAB_DEFINITIONS.filter((tab) => tab.id !== "users");
const ROLE_DEFAULTS = {
  admin: {
    canWrite: true,
    visibleTabs: TAB_DEFINITIONS.map((tab) => tab.id),
  },
  viewer: {
    canWrite: false,
    visibleTabs: USER_MANAGED_TABS.map((tab) => tab.id),
  },
};
const HOSTED_CONFIG = {
  supabaseUrl: String(window.APP_CONFIG?.supabaseUrl || "").trim(),
  supabaseAnonKey: String(window.APP_CONFIG?.supabaseAnonKey || "").trim(),
  adminUsersFunctionName: String(window.APP_CONFIG?.adminUsersFunctionName || "admin-users").trim() || "admin-users",
};
const defaultSeasonStore = {
  activeSeasonId: null,
  seasons: [],
  seasonStates: {},
};

const defaultData = {
  season: { name: "2026/27", notes: "" },
  settings: { warmupMinutes: 30, packAwayMinutes: 15, showVisualPlanner: true, summerTrainingStartDate: "", summerTrainingEndDate: "" },
  teams: [],
  venues: [],
  pitches: [],
  matchSlots: [],
  friendlyBookings: [],
  pitchBlocks: [],
  lockedAssignments: [],
  winterTrainingAssignments: [],
  summerTrainingAssignments: [],
};

let state = structuredClone(defaultData);
let seasonStore = structuredClone(defaultSeasonStore);
let persistenceDbPromise = null;
let supabaseClient = null;
const editState = {
  teamId: null,
  venueId: null,
  pitchId: null,
  slotId: null,
  friendlyBookingId: null,
  pitchBlockId: null,
  winterTeamId: null,
  summerTeamId: null,
  userId: null,
};
const plannerUiState = {
  moveTeamId: null,
  dragTeamId: null,
  friendlyPendingPitchId: null,
  winterTrainingCollapsed: readUiBoolean(WINTER_TRAINING_COLLAPSED_KEY, false),
};
const authState = {
  enabled: Boolean(HOSTED_CONFIG.supabaseUrl && HOSTED_CONFIG.supabaseAnonKey && window.supabase?.createClient),
  ready: false,
  session: null,
  user: null,
  profile: null,
  users: [],
};

const authCard = document.getElementById("auth-card");
const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const authMessage = document.getElementById("auth-message");
const sessionPanel = document.getElementById("session-panel");
const sessionTitle = document.getElementById("session-title");
const sessionMeta = document.getElementById("session-meta");
const signOutBtn = document.getElementById("sign-out-btn");
const appMain = document.getElementById("app-main");
const seasonSelect = document.getElementById("season-select");
const seasonNewBtn = document.getElementById("season-new-btn");
const seasonDuplicateBtn = document.getElementById("season-duplicate-btn");
const seasonForm = document.getElementById("season-form");
const seasonNameInput = document.getElementById("season-name");
const seasonNotesInput = document.getElementById("season-notes");
const settingsForm = document.getElementById("settings-form");
const warmupMinutesInput = document.getElementById("warmup-minutes");
const packawayMinutesInput = document.getElementById("packaway-minutes");
const showVisualPlannerInput = document.getElementById("show-visual-planner");
const teamForm = document.getElementById("team-form");
const teamsBody = document.getElementById("teams-body");
const teamSubmitBtn = document.getElementById("team-submit-btn");
const teamCancelBtn = document.getElementById("team-cancel-btn");
const venueForm = document.getElementById("venue-form");
const venuesBody = document.getElementById("venues-body");
const venueSubmitBtn = document.getElementById("venue-submit-btn");
const venueCancelBtn = document.getElementById("venue-cancel-btn");
const pitchForm = document.getElementById("pitch-form");
const pitchVenueSelect = document.getElementById("pitch-venue");
const pitchesBody = document.getElementById("pitches-body");
const pitchSubmitBtn = document.getElementById("pitch-submit-btn");
const pitchCancelBtn = document.getElementById("pitch-cancel-btn");
const slotForm = document.getElementById("slot-form");
const slotDaySelect = document.getElementById("slot-day");
const slotPitchSelect = document.getElementById("slot-pitch");
const slotsBody = document.getElementById("slots-body");
const slotSubmitBtn = document.getElementById("slot-submit-btn");
const slotCancelBtn = document.getElementById("slot-cancel-btn");
const friendlyBookingForm = document.getElementById("friendly-booking-form");
const friendlyTeamSelect = document.getElementById("friendly-team");
const friendlyDateInput = document.getElementById("friendly-date");
const friendlyKickoffInput = document.getElementById("friendly-kickoff");
const friendlyDurationSelect = document.getElementById("friendly-duration");
const friendlyPitchSelect = document.getElementById("friendly-pitch");
const friendlyOpponentInput = document.getElementById("friendly-opponent");
const friendlyNotesInput = document.getElementById("friendly-notes");
const friendlyCalendarMonthInput = document.getElementById("friendly-calendar-month");
const friendlySubmitBtn = document.getElementById("friendly-submit-btn");
const friendlyCancelBtn = document.getElementById("friendly-cancel-btn");
const pitchBlockForm = document.getElementById("pitch-block-form");
const pitchBlockPitchSelect = document.getElementById("pitch-block-pitch");
const pitchBlockStartDateInput = document.getElementById("pitch-block-start-date");
const pitchBlockEndDateInput = document.getElementById("pitch-block-end-date");
const pitchBlockStartInput = document.getElementById("pitch-block-start");
const pitchBlockEndInput = document.getElementById("pitch-block-end");
const pitchBlockReasonInput = document.getElementById("pitch-block-reason");
const pitchBlockSubmitBtn = document.getElementById("pitch-block-submit-btn");
const pitchBlockCancelBtn = document.getElementById("pitch-block-cancel-btn");
const friendlyMessage = document.getElementById("friendly-message");
const friendlyDayBoard = document.getElementById("friendly-day-board");
const friendlyCalendar = document.getElementById("friendly-calendar");
const plannerMessage = document.getElementById("planner-message");
const trainingMessage = document.getElementById("training-message");
const optimisedHomePlan = document.getElementById("optimised-home-plan");
const kickoffSuggestions = document.getElementById("kickoff-suggestions");
const visualPlanner = document.getElementById("visual-planner");
const hideVisualPlannerBtn = document.getElementById("hide-visual-planner-btn");
const winterAssignmentForm = document.getElementById("winter-assignment-form");
const winterTeamSelect = document.getElementById("winter-team");
const winterDaySelect = document.getElementById("winter-day");
const winterTimeSelect = document.getElementById("winter-time");
const winterSharedWithSelect = document.getElementById("winter-shared-with");
const winterSubmitBtn = document.getElementById("winter-submit-btn");
const winterCancelBtn = document.getElementById("winter-cancel-btn");
const winterAutoBtn = document.getElementById("winter-auto-btn");
const winterClearBtn = document.getElementById("winter-clear-btn");
const winterPdfBtn = document.getElementById("winter-pdf-btn");
const winterCollapseBtn = document.getElementById("winter-collapse-btn");
const winterTrainingSection = document.getElementById("winter-training-section");
const winterTrainingContent = document.getElementById("winter-training-content");
const winterTrainingBoard = document.getElementById("winter-training-board");
const winterTrainingVisual = document.getElementById("winter-training-visual");
const summerTrainingForm = document.getElementById("summer-training-form");
const summerTeamSelect = document.getElementById("summer-team");
const summerVenueSelect = document.getElementById("summer-venue");
const summerDaySelect = summerTrainingForm.elements.day;
const summerTimeSelect = summerTrainingForm.elements.time;
const summerSharedWithSelect = document.getElementById("summer-shared-with");
const summerSubmitBtn = document.getElementById("summer-submit-btn");
const summerCancelBtn = document.getElementById("summer-cancel-btn");
const summerAutoBtn = document.getElementById("summer-auto-btn");
const summerClearBtn = document.getElementById("summer-clear-btn");
const summerPdfBtn = document.getElementById("summer-pdf-btn");
const summerTrainingStartDateInput = document.getElementById("summer-training-start-date");
const summerTrainingEndDateInput = document.getElementById("summer-training-end-date");
const summerTrainingBoard = document.getElementById("summer-training-board");
const summerTrainingVisual = document.getElementById("summer-training-visual");
const exportBtn = document.getElementById("export-btn");
const importInput = document.getElementById("import-file");
const importLabel = document.querySelector(".import-label");
const userForm = document.getElementById("user-form");
const userDisplayNameInput = document.getElementById("user-display-name");
const userEmailInput = document.getElementById("user-email");
const userPasswordInput = document.getElementById("user-password");
const userRoleSelect = document.getElementById("user-role");
const userCanWriteOverrideEnabledInput = document.getElementById("user-can-write-override-enabled");
const userCanWriteOverrideInput = document.getElementById("user-can-write-override");
const userTabOverrides = document.getElementById("user-tab-overrides");
const userSubmitBtn = document.getElementById("user-submit-btn");
const userCancelBtn = document.getElementById("user-cancel-btn");
const usersBody = document.getElementById("users-body");
const usersMessage = document.getElementById("users-message");
const refreshUsersBtn = document.getElementById("refresh-users-btn");
const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const visualTabButton = document.querySelector('[data-tab-target="visual"]');

init();

async function init() {
  bindEvents();
  renderUserTabOverrideInputs();
  syncUserOverrideControls();
  if (authState.enabled) {
    await initialiseHostedMode();
    return;
  }
  await loadState();
  authState.ready = true;
  renderAll();
}

function bindEvents() {
  loginForm.addEventListener("submit", onSignIn);
  signOutBtn.addEventListener("click", onSignOut);
  seasonSelect.addEventListener("change", onSelectSeason);
  seasonNewBtn.addEventListener("click", () => createSeason(false));
  seasonDuplicateBtn.addEventListener("click", () => createSeason(true));
  seasonForm.addEventListener("submit", onSaveSeason);
  settingsForm.addEventListener("submit", onSaveSettings);
  teamForm.addEventListener("submit", onSaveTeam);
  venueForm.addEventListener("submit", onSaveVenue);
  pitchForm.addEventListener("submit", onSavePitch);
  slotForm.addEventListener("submit", onSaveSlot);
  friendlyBookingForm.addEventListener("submit", onSaveFriendlyBooking);
  friendlyCancelBtn.addEventListener("click", resetFriendlyBookingForm);
  pitchBlockForm.addEventListener("submit", onSavePitchBlock);
  pitchBlockCancelBtn.addEventListener("click", resetPitchBlockForm);
  friendlyTeamSelect.addEventListener("change", () => renderFriendlyPitchOptions(plannerUiState.friendlyPendingPitchId || friendlyPitchSelect.value));
  friendlyPitchSelect.addEventListener("change", () => {
    plannerUiState.friendlyPendingPitchId = friendlyPitchSelect.value || null;
  });
  friendlyDateInput.addEventListener("change", onFriendlyDateChange);
  pitchBlockStartDateInput.addEventListener("change", onPitchBlockDateChange);
  pitchBlockEndDateInput.addEventListener("change", onPitchBlockDateChange);
  friendlyCalendarMonthInput.addEventListener("change", renderFriendlyCalendar);
  winterAssignmentForm.addEventListener("submit", onSaveWinterAssignment);
  summerTrainingForm.addEventListener("submit", onSaveSummerTraining);
  exportBtn.addEventListener("click", onExport);
  importInput.addEventListener("change", onImport);
  hideVisualPlannerBtn.addEventListener("click", hideVisualPlannerTab);
  teamCancelBtn.addEventListener("click", resetTeamForm);
  venueCancelBtn.addEventListener("click", resetVenueForm);
  pitchCancelBtn.addEventListener("click", resetPitchForm);
  slotCancelBtn.addEventListener("click", resetSlotForm);
  winterCancelBtn.addEventListener("click", resetWinterAssignmentForm);
  winterAutoBtn.addEventListener("click", autoFillWinterAssignments);
  winterClearBtn.addEventListener("click", clearWinterAssignments);
  winterPdfBtn.addEventListener("click", () => openTrainingPlanPdf("winter"));
  winterCollapseBtn.addEventListener("click", toggleWinterTrainingCollapse);
  [winterTeamSelect, winterDaySelect, winterTimeSelect].forEach((control) =>
    control.addEventListener("change", () => renderWinterSharedWithOptions())
  );
  summerAutoBtn.addEventListener("click", autoFillSummerAssignments);
  summerClearBtn.addEventListener("click", clearSummerAssignments);
  summerPdfBtn.addEventListener("click", () => openTrainingPlanPdf("summer"));
  summerTrainingStartDateInput.addEventListener("change", onSaveSummerTrainingDateRange);
  summerTrainingEndDateInput.addEventListener("change", onSaveSummerTrainingDateRange);
  summerCancelBtn.addEventListener("click", resetSummerTrainingForm);
  [summerTeamSelect, summerVenueSelect, summerDaySelect, summerTimeSelect].forEach((control) =>
    control.addEventListener("change", () => renderSummerSharedWithOptions())
  );
  userForm.addEventListener("submit", onSaveUser);
  userCancelBtn.addEventListener("click", resetUserForm);
  refreshUsersBtn.addEventListener("click", refreshUserDirectory);
  userRoleSelect.addEventListener("change", syncUserOverrideControls);
  userCanWriteOverrideEnabledInput.addEventListener("change", syncUserOverrideControls);
  tabButtons.forEach((button) =>
    button.addEventListener("click", () => setActiveTab(button.getAttribute("data-tab-target")))
  );
}

function renderAll() {
  renderSeasonOptions();
  seasonNameInput.value = state.season.name;
  seasonNotesInput.value = state.season.notes;
  warmupMinutesInput.value = state.settings.warmupMinutes;
  packawayMinutesInput.value = state.settings.packAwayMinutes;
  showVisualPlannerInput.checked = state.settings.showVisualPlanner;
  summerTrainingStartDateInput.value = state.settings.summerTrainingStartDate || "";
  summerTrainingEndDateInput.value = state.settings.summerTrainingEndDate || "";
  renderTeams();
  renderVenues();
  renderPitchVenueOptions();
  renderPitches();
  renderSlotPitchOptions();
  renderMatchSlots();
  renderFriendlyBookingPlanner();
  renderPlannerOutputs();
  renderWinterTrainingPlanner();
  renderSummerTrainingPlanner();
  renderUsers();
  syncWinterTrainingCollapse();
  syncEditorButtons();
  syncVisualPlannerTab();
  syncPermissionUi();
  syncAuthUi();
  setActiveTab(getAccessibleTabName(getActiveTabName() || "settings"));
}

function normalizeState(rawState = {}) {
  const teams = (rawState.teams || []).map((team) => ({
    id: team.id || id("team"),
    name: String(team.name || "").trim(),
    ageGroup: String(team.ageGroup || "").trim(),
    colour: String(team.colour || "").trim(),
    format: String(team.format || "7v7"),
    gender: String(team.gender || "Mixed"),
    matchDay: DAYS.includes(team.matchDay) ? team.matchDay : "Saturday",
    matchLengthMinutes: toPositiveInt(team.matchLengthMinutes, 60),
    kickoffPreference: normalizeKickoffPreference(team.kickoffPreference),
    winterTrainingAreas: normalizeWinterTrainingAreas(team.winterTrainingAreas),
    winterTrainingPreference: normalizeWinterTrainingPreference(team.winterTrainingPreference),
    manager: String(team.manager || "").trim(),
    assistantManager: String(team.assistantManager || "").trim(),
  }));
  const venues = (rawState.venues || []).map((venue) => ({
    id: venue.id || id("venue"),
    name: String(venue.name || "").trim(),
    summerTrainingAreas: toPositiveInt(venue.summerTrainingAreas, 0),
    address: String(venue.address || "").trim(),
  }));
  const pitches = (rawState.pitches || []).map((pitch) => ({
    id: pitch.id || id("pitch"),
    venueId: String(pitch.venueId || ""),
    name: String(pitch.name || "").trim(),
    usage: String(pitch.usage || "Match"),
    overlayGroup: String(pitch.overlayGroup || "").trim(),
    formats: Array.isArray(pitch.formats) ? pitch.formats.map(String) : [],
  }));
  const legacyMatchSlots = Array.isArray(rawState.allocations)
    ? rawState.allocations.filter((item) => item.type === "Match").map((item) => ({
        id: item.id || id("slot"),
        pitchId: String(item.pitchId || ""),
        day: DAYS.includes(item.day) ? item.day : "Saturday",
        kickoffTime: String(item.kickoffTime || item.startTime || ""),
        label: String(item.notes || "").trim(),
      }))
    : [];
  const matchSlots = (Array.isArray(rawState.matchSlots) ? rawState.matchSlots : legacyMatchSlots).map((slot) => ({
    id: slot.id || id("slot"),
    pitchId: String(slot.pitchId || ""),
    day: DAYS.includes(slot.day) ? slot.day : "Saturday",
    kickoffTime: String(slot.kickoffTime || slot.startTime || ""),
    label: String(slot.label || "").trim(),
  }));
  const friendlyBookings = Array.isArray(rawState.friendlyBookings)
    ? rawState.friendlyBookings
        .map((booking) => ({
          id: booking.id || id("friendly"),
          teamId: String(booking.teamId || ""),
          pitchId: String(booking.pitchId || ""),
          date: normalizeDateInput(booking.date),
          kickoffTime: normalizeTimeInput(booking.kickoffTime || booking.startTime),
          durationMinutes: toPositiveInt(booking.durationMinutes, 90),
          opponent: String(booking.opponent || "").trim(),
          notes: String(booking.notes || "").trim(),
        }))
        .filter((booking) => booking.teamId && booking.pitchId && booking.date && booking.kickoffTime)
    : [];
  const pitchBlocks = Array.isArray(rawState.pitchBlocks)
    ? rawState.pitchBlocks
        .map((block) => {
          const startDate = normalizeDateInput(block.startDate || block.date);
          const endDate = normalizeDateInput(block.endDate || block.date) || startDate;
          return {
            id: block.id || id("block"),
            pitchId: String(block.pitchId || ""),
            startDate,
            endDate,
            startTime: normalizeTimeInput(block.startTime),
            endTime: normalizeTimeInput(block.endTime),
            reason: String(block.reason || "").trim(),
          };
        })
        .filter((block) => block.pitchId && block.startDate && block.endDate && block.endDate >= block.startDate && block.startTime && block.endTime)
    : [];
  const lockedAssignments = Array.isArray(rawState.lockedAssignments)
    ? rawState.lockedAssignments
        .map((assignment) => ({
          teamId: String(assignment.teamId || ""),
          slotId: String(assignment.slotId || ""),
        }))
        .filter((assignment) => assignment.teamId && assignment.slotId)
        .filter(
          (assignment, index, all) =>
            all.findIndex((candidate) => candidate.teamId === assignment.teamId) === index
        )
    : [];
  const winterTrainingAssignments = Array.isArray(rawState.winterTrainingAssignments)
    ? rawState.winterTrainingAssignments
        .map((assignment) => ({
          teamId: String(assignment.teamId || ""),
          day: WINTER_TRAINING_DAYS.includes(assignment.day) ? assignment.day : "Monday",
          time: normalizeWinterTrainingPreference(assignment.time),
          sharedWithTeamId: String(assignment.sharedWithTeamId || ""),
        }))
        .filter((assignment) => assignment.teamId)
        .filter(
          (assignment, index, all) =>
            all.findIndex((candidate) => candidate.teamId === assignment.teamId) === index
        )
    : [];
  const legacySummerAssignments = Array.isArray(rawState.summerTrainingSessions)
    ? rawState.summerTrainingSessions
        .map((session) => ({
          teamId: String(session.teamId || ""),
          venueId: String(session.venueId || ""),
          day: WINTER_TRAINING_DAYS.includes(session.day) ? session.day : "Monday",
          time: normalizeWinterTrainingPreference(session.time || session.startTime),
          sharedWithTeamId: String(session.sharedWithTeamId || ""),
        }))
        .filter((assignment) => assignment.teamId && assignment.venueId)
    : [];
  const summerTrainingAssignments = (
    Array.isArray(rawState.summerTrainingAssignments)
      ? rawState.summerTrainingAssignments
      : legacySummerAssignments
  )
    .map((assignment) => ({
      teamId: String(assignment.teamId || ""),
      venueId: String(assignment.venueId || ""),
      day: WINTER_TRAINING_DAYS.includes(assignment.day) ? assignment.day : "Monday",
      time: normalizeWinterTrainingPreference(assignment.time),
      sharedWithTeamId: String(assignment.sharedWithTeamId || ""),
    }))
    .filter((assignment) => assignment.teamId && assignment.venueId)
    .filter(
      (assignment, index, all) =>
        all.findIndex((candidate) => candidate.teamId === assignment.teamId) === index
    );
  const summerTrainingStartDate = normalizeDateInput(rawState.settings?.summerTrainingStartDate);
  const rawSummerTrainingEndDate = normalizeDateInput(rawState.settings?.summerTrainingEndDate);
  const summerTrainingEndDate = rawSummerTrainingEndDate && summerTrainingStartDate && rawSummerTrainingEndDate < summerTrainingStartDate
    ? summerTrainingStartDate
    : rawSummerTrainingEndDate;
  return {
    season: { ...defaultData.season, ...(rawState.season || {}) },
    settings: {
      warmupMinutes: toPositiveInt(rawState.settings?.warmupMinutes, defaultData.settings.warmupMinutes),
      packAwayMinutes: toPositiveInt(rawState.settings?.packAwayMinutes, defaultData.settings.packAwayMinutes),
      showVisualPlanner: toBoolean(rawState.settings?.showVisualPlanner, defaultData.settings.showVisualPlanner),
      summerTrainingStartDate,
      summerTrainingEndDate,
    },
    teams,
    venues,
    pitches,
    matchSlots,
    friendlyBookings,
    pitchBlocks,
    lockedAssignments,
    winterTrainingAssignments,
    summerTrainingAssignments,
  };
}

function createSeasonState(name = defaultData.season.name, notes = "") {
  return normalizeState({
    ...structuredClone(defaultData),
    season: { name, notes },
  });
}

function getSeasonPreferenceKey() {
  return `gljfc-active-season-${authState.user?.id || "local"}`;
}

function readUiBoolean(key, fallback = false) {
  try {
    const value = localStorage.getItem(key);
    if (value === "true") return true;
    if (value === "false") return false;
  } catch {}
  return fallback;
}

function writeUiBoolean(key, value) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {}
}

function rememberActiveSeason(seasonId) {
  try {
    localStorage.setItem(getSeasonPreferenceKey(), seasonId);
  } catch {}
}

function getRememberedActiveSeasonId() {
  try {
    return localStorage.getItem(getSeasonPreferenceKey());
  } catch {
    return null;
  }
}

function normalizeSeasonStore(rawStore = {}) {
  if (Array.isArray(rawStore.seasons) && rawStore.seasonStates && typeof rawStore.seasonStates === "object") {
    const normalizedStore = {
      activeSeasonId: null,
      seasons: [],
      seasonStates: {},
    };

    rawStore.seasons.forEach((seasonId) => {
      const normalizedId = String(seasonId || "").trim();
      if (!normalizedId || normalizedStore.seasons.includes(normalizedId)) return;
      normalizedStore.seasons.push(normalizedId);
      const rawSeasonState = rawStore.seasonStates?.[normalizedId] || {};
      normalizedStore.seasonStates[normalizedId] = normalizeState(rawSeasonState);
    });

    if (!normalizedStore.seasons.length) {
      return createLegacySeasonStore(rawStore);
    }

    const rememberedSeasonId = String(getRememberedActiveSeasonId() || "");
    normalizedStore.activeSeasonId = normalizedStore.seasons.includes(rememberedSeasonId)
      ? rememberedSeasonId
      : normalizedStore.seasons.includes(String(rawStore.activeSeasonId || ""))
        ? String(rawStore.activeSeasonId)
        : normalizedStore.seasons[0];
    rememberActiveSeason(normalizedStore.activeSeasonId);
    return normalizedStore;
  }

  return createLegacySeasonStore(rawStore);
}

function createLegacySeasonStore(rawState = {}) {
  const legacyState = normalizeState(rawState);
  const seasonId = String(rawState.season?.id || id("season"));
  rememberActiveSeason(seasonId);
  return {
    activeSeasonId: seasonId,
    seasons: [seasonId],
    seasonStates: {
      [seasonId]: legacyState,
    },
  };
}

function cloneCurrentState() {
  return normalizeState(structuredClone(state));
}

function persistCurrentSeasonInStore() {
  const seasonId = seasonStore.activeSeasonId;
  if (!seasonId) return;
  seasonStore.seasonStates[seasonId] = cloneCurrentState();
  if (!seasonStore.seasons.includes(seasonId)) {
    seasonStore.seasons.push(seasonId);
  }
}

function applySeasonStore(nextStore) {
  seasonStore = normalizeSeasonStore(nextStore);
  state = normalizeState(structuredClone(seasonStore.seasonStates[seasonStore.activeSeasonId]));
}

function getSeasonStateById(seasonId) {
  return seasonStore.seasonStates[seasonId]
    ? normalizeState(structuredClone(seasonStore.seasonStates[seasonId]))
    : createSeasonState();
}

function getCurrentSeasonId() {
  return seasonStore.activeSeasonId;
}

function getSeasonDisplayName(seasonId) {
  return seasonStore.seasonStates[seasonId]?.season?.name || "Unnamed season";
}

function renderSeasonOptions() {
  seasonSelect.innerHTML = "";
  seasonStore.seasons.forEach((seasonId) => {
    const option = document.createElement("option");
    option.value = seasonId;
    option.textContent = getSeasonDisplayName(seasonId);
    seasonSelect.appendChild(option);
  });
  if (seasonStore.seasons.includes(seasonStore.activeSeasonId)) {
    seasonSelect.value = seasonStore.activeSeasonId;
  }
}

async function initialiseHostedMode() {
  supabaseClient = window.supabase.createClient(HOSTED_CONFIG.supabaseUrl, HOSTED_CONFIG.supabaseAnonKey);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    void applySessionState(session);
  });
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  await applySessionState(session);
}

async function applySessionState(session) {
  authState.session = session;
  authState.user = session?.user || null;
  authState.profile = null;
  authState.users = [];

  if (!session) {
    applySeasonStore(createLegacySeasonStore(defaultData));
    authState.ready = true;
    renderAll();
    return;
  }

  const profile = await loadCurrentUserProfile();
  authState.profile = profile;
  if (profile?.isActive) {
    await loadState();
    if (isCurrentUserAdmin()) {
      await refreshUserDirectory({ quiet: true });
    }
  } else {
    applySeasonStore(createLegacySeasonStore(defaultData));
  }
  authState.ready = true;
  renderAll();
}

function normalizeProfile(rawProfile = {}) {
  return {
    userId: String(rawProfile.user_id || rawProfile.userId || ""),
    email: String(rawProfile.email || "").trim(),
    displayName: String(rawProfile.display_name || rawProfile.displayName || "").trim(),
    role: String(rawProfile.role || "viewer").toLowerCase() === "admin" ? "admin" : "viewer",
    canWriteOverride:
      typeof rawProfile.can_write_override === "boolean"
        ? rawProfile.can_write_override
        : typeof rawProfile.canWriteOverride === "boolean"
          ? rawProfile.canWriteOverride
          : null,
    tabOverrides: normalizeTabOverrides(rawProfile.tab_overrides || rawProfile.tabOverrides || {}),
    isActive: toBoolean(rawProfile.is_active, true),
  };
}

function normalizeTabOverrides(rawOverrides = {}) {
  const normalized = {};
  for (const tab of USER_MANAGED_TABS) {
    const value = rawOverrides?.[tab.id];
    if (typeof value === "boolean") {
      normalized[tab.id] = value;
    }
  }
  return normalized;
}

function getRoleDefaults(role = "viewer") {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.viewer;
}

function getEffectivePermissions(profile = authState.profile) {
  if (!profile) return { canWrite: false, visibleTabs: [] };
  const defaults = getRoleDefaults(profile.role);
  const visibleTabs = new Set(defaults.visibleTabs);
  for (const [tabId, visible] of Object.entries(profile.tabOverrides || {})) {
    if (visible) visibleTabs.add(tabId);
    else visibleTabs.delete(tabId);
  }
  if (profile.role !== "admin") {
    visibleTabs.delete("users");
    visibleTabs.add("training");
  }
  return {
    canWrite: typeof profile.canWriteOverride === "boolean" ? profile.canWriteOverride : defaults.canWrite,
    visibleTabs: TAB_DEFINITIONS
      .map((tab) => tab.id)
      .filter((tabId) => visibleTabs.has(tabId)),
  };
}

function isCurrentUserSignedIn() {
  return Boolean(authState.enabled && authState.session && authState.user);
}

function isCurrentUserAdmin() {
  return authState.enabled ? authState.profile?.role === "admin" : false;
}

function canCurrentUserWrite() {
  if (!authState.enabled) return true;
  if (!authState.profile?.isActive) return false;
  return getEffectivePermissions().canWrite;
}

function canCurrentUserEditFriendlies() {
  if (!authState.enabled) return true;
  return Boolean(authState.profile?.isActive);
}

function canCurrentUserEditTraining() {
  if (!authState.enabled) return true;
  return Boolean(authState.profile?.isActive && isCurrentUserAdmin() && canCurrentUserWrite());
}

function userCanAccessTab(tabName, profile = authState.profile) {
  if (!authState.enabled) return tabName !== "users";
  if (!profile?.isActive) return false;
  return getEffectivePermissions(profile).visibleTabs.includes(tabName);
}

function getAccessibleTabName(preferredTab = "settings") {
  if (userCanAccessTab(preferredTab)) {
    return preferredTab;
  }
  return (
    TAB_DEFINITIONS.find((tab) => userCanAccessTab(tab.id) && (tab.id !== "visual" || state.settings.showVisualPlanner))?.id ||
    null
  );
}

function getTabLabel(tabId) {
  return TAB_DEFINITIONS.find((tab) => tab.id === tabId)?.label || tabId;
}

async function loadCurrentUserProfile() {
  try {
    const { data, error } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("user_id", authState.user.id)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizeProfile(data) : null;
  } catch (error) {
    console.error("Failed to load user profile.", error);
    setAuthMessage("Signed in, but no access profile was found for this account.", "error");
    return null;
  }
}

async function loadState() {
  if (authState.enabled) {
    return loadRemoteState();
  }
  try {
    const db = await getPersistenceDb();
    const persistedState = await readPersistedState(db);
    if (persistedState) {
      applySeasonStore(persistedState);
      return state;
    }

    const migratedState = loadLegacyLocalState();
    if (migratedState) {
      applySeasonStore(migratedState);
      await writePersistedState(db, seasonStore);
      clearLegacyLocalState();
      return state;
    }
  } catch (error) {
    console.error("Failed to load IndexedDB state.", error);
    const migratedState = loadLegacyLocalState();
    if (migratedState) {
      applySeasonStore(migratedState);
      return state;
    }
  }

  applySeasonStore(createLegacySeasonStore(defaultData));
  return state;
}

async function saveState({ allowFriendliesWrite = false } = {}) {
  persistCurrentSeasonInStore();
  if (authState.enabled) {
    await saveRemoteState({ allowFriendliesWrite });
    return;
  }
  try {
    const db = await getPersistenceDb();
    await writePersistedState(db, seasonStore);
  } catch (error) {
    console.error("Failed to save IndexedDB state.", error);
  }
}

async function loadRemoteState() {
  try {
    const { data, error } = await supabaseClient
      .from("app_state")
      .select("data")
      .eq("id", REMOTE_STATE_RECORD_ID)
      .maybeSingle();
    if (error) throw error;
    if (!data?.data || !Object.keys(data.data).length) {
      applySeasonStore(createLegacySeasonStore(defaultData));
      return state;
    }
    applySeasonStore(data.data);
    return state;
  } catch (error) {
    console.error("Failed to load Supabase state.", error);
    setMessage("Unable to load shared data from Supabase.", "error");
    applySeasonStore(createLegacySeasonStore(defaultData));
    return state;
  }
}

async function saveRemoteState({ allowFriendliesWrite = false } = {}) {
  if (!canCurrentUserWrite()) {
    if (allowFriendliesWrite && canCurrentUserEditFriendlies()) {
      await saveRemoteFriendlyBookings();
    }
    return;
  }
  try {
    const { error } = await supabaseClient.from("app_state").upsert({
      id: REMOTE_STATE_RECORD_ID,
      data: seasonStore,
      updated_by: authState.user?.id || null,
    });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to save Supabase state.", error);
    setMessage("Unable to save shared data to Supabase.", "error");
  }
}

async function saveRemoteFriendlyBookings() {
  const seasonId = getCurrentSeasonId();
  if (!seasonId) return;

  try {
    const { data, error } = await supabaseClient
      .from("app_state")
      .select("data")
      .eq("id", REMOTE_STATE_RECORD_ID)
      .maybeSingle();
    if (error) throw error;

    const rawRemoteStore = data?.data || seasonStore;
    const remoteStore = normalizeSeasonStore(rawRemoteStore);
    if (rawRemoteStore?.activeSeasonId) {
      remoteStore.activeSeasonId = String(rawRemoteStore.activeSeasonId);
    }
    if (!remoteStore.seasonStates[seasonId]) {
      throw new Error("This season is not available in the shared planner.");
    }

    const localSeasonState = seasonStore.seasonStates[seasonId] || state;
    remoteStore.seasonStates[seasonId] = normalizeState({
      ...remoteStore.seasonStates[seasonId],
      friendlyBookings: localSeasonState.friendlyBookings,
    });

    const { error: updateError } = await supabaseClient.from("app_state").update({
      data: remoteStore,
      updated_by: authState.user?.id || null,
    }).eq("id", REMOTE_STATE_RECORD_ID);
    if (updateError) throw updateError;
  } catch (error) {
    console.error("Failed to save friendly bookings to Supabase.", error);
    setFriendlyMessage("Unable to save friendly bookings to Supabase.", "error");
  }
}

function requireWriteAccess() {
  if (canCurrentUserWrite()) return true;
  setMessage("This account is read-only.", "error");
  return false;
}

function requireFriendlyWriteAccess() {
  if (canCurrentUserEditFriendlies()) return true;
  setFriendlyMessage("This account cannot change friendly bookings.", "error");
  return false;
}

function requireTrainingWriteAccess() {
  if (canCurrentUserEditTraining()) return true;
  setTrainingMessage("Only admins with write access can change training plans.", "error");
  return false;
}

function requireAdminAccess() {
  if (isCurrentUserAdmin()) return true;
  setUsersMessage("Admin access is required to manage users.", "error");
  return false;
}

function renderUserTabOverrideInputs(overrides = {}) {
  userTabOverrides.innerHTML = USER_MANAGED_TABS.map((tab) => {
    const current = overrides[tab.id];
    const value = typeof current === "boolean" ? (current ? "show" : "hide") : "default";
    return `
      <label class="tab-override-control">
        <span>${escapeHtml(tab.label)}</span>
        <select name="tab-override-${tab.id}">
          <option value="default"${value === "default" ? " selected" : ""}>Default</option>
          <option value="show"${value === "show" ? " selected" : ""}>Show</option>
          <option value="hide"${value === "hide" ? " selected" : ""}>Hide</option>
        </select>
      </label>`;
  }).join("");
}

function readUserTabOverrides() {
  const overrides = {};
  USER_MANAGED_TABS.forEach((tab) => {
    const control = userTabOverrides.querySelector(`[name="tab-override-${tab.id}"]`);
    const value = control?.value || "default";
    if (value === "show") overrides[tab.id] = true;
    if (value === "hide") overrides[tab.id] = false;
  });
  return overrides;
}

function syncUserOverrideControls() {
  userCanWriteOverrideInput.disabled = !userCanWriteOverrideEnabledInput.checked;
  if (!userCanWriteOverrideEnabledInput.checked) {
    const defaults = getRoleDefaults(userRoleSelect.value);
    userCanWriteOverrideInput.checked = defaults.canWrite;
  }
  userPasswordInput.required = !editState.userId;
  userPasswordInput.placeholder = editState.userId ? "Leave blank to keep current password" : "Required for new users";
}

function syncAuthUi() {
  if (!authState.ready) {
    appMain.hidden = true;
    sessionPanel.hidden = true;
    return;
  }

  sessionPanel.hidden = false;
  if (!authState.enabled) {
    authCard.hidden = true;
    appMain.hidden = false;
    signOutBtn.hidden = true;
    sessionTitle.textContent = "Local Mode";
    sessionMeta.textContent = "Running without Supabase. Data stays in this browser until hosted mode is configured.";
    return;
  }

  const signedIn = isCurrentUserSignedIn();
  authCard.hidden = signedIn;
  signOutBtn.hidden = !signedIn;

  if (!signedIn) {
    appMain.hidden = true;
    sessionTitle.textContent = "Sign In Required";
    sessionMeta.textContent = "Use a shared account to access the hosted planner.";
    return;
  }

  if (!authState.profile) {
    appMain.hidden = true;
    sessionTitle.textContent = "Profile Missing";
    sessionMeta.textContent = "This account is authenticated, but no access profile exists for it yet.";
    return;
  }

  if (!authState.profile.isActive) {
    appMain.hidden = true;
    sessionTitle.textContent = "Access Disabled";
    sessionMeta.textContent = `${authState.profile.email} is currently inactive.`;
    return;
  }

  appMain.hidden = false;
  const effectivePermissions = getEffectivePermissions();
  sessionTitle.textContent = authState.profile.displayName || authState.profile.email;
  sessionMeta.textContent =
    `${authState.profile.role === "admin" ? "Admin" : "Viewer"} · ` +
    `${effectivePermissions.canWrite ? "Write access" : "Read only"} · ${authState.profile.email}`;
}

function syncPermissionUi() {
  const writeAllowed = canCurrentUserWrite();
  const friendlyWriteAllowed = canCurrentUserEditFriendlies();
  const trainingWriteAllowed = canCurrentUserEditTraining();
  const manageUsersAllowed = isCurrentUserAdmin();
  const editableForms = [
    seasonForm,
    settingsForm,
    teamForm,
    venueForm,
    pitchForm,
    slotForm,
    pitchBlockForm,
  ];

  editableForms.forEach((form) => toggleFormDisabled(form, !writeAllowed));
  toggleFormDisabled(friendlyBookingForm, !friendlyWriteAllowed);
  toggleFormDisabled(winterAssignmentForm, !trainingWriteAllowed);
  toggleFormDisabled(summerTrainingForm, !trainingWriteAllowed);
  winterPdfBtn.disabled = false;
  summerPdfBtn.disabled = false;
  summerTrainingStartDateInput.disabled = !trainingWriteAllowed;
  summerTrainingEndDateInput.disabled = !trainingWriteAllowed;
  seasonSelect.disabled = seasonStore.seasons.length < 2;
  seasonNewBtn.disabled = !writeAllowed;
  seasonDuplicateBtn.disabled = !writeAllowed;
  hideVisualPlannerBtn.disabled = !writeAllowed;
  importInput.disabled = !writeAllowed;
  importLabel?.classList.toggle("is-disabled", !writeAllowed);
  toggleFormDisabled(userForm, !manageUsersAllowed);
  refreshUsersBtn.disabled = !manageUsersAllowed;
}

function toggleFormDisabled(form, disabled) {
  form.querySelectorAll("input, select, textarea, button").forEach((element) => {
    element.disabled = disabled;
  });
}

async function onSignIn(event) {
  event.preventDefault();
  if (!authState.enabled) return;

  setAuthMessage("Signing in...", "ok");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: loginEmailInput.value.trim(),
    password: loginPasswordInput.value,
  });
  if (error) {
    setAuthMessage(error.message, "error");
    return;
  }

  loginForm.reset();
  setAuthMessage("", "ok");
}

async function onSignOut() {
  if (!authState.enabled) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setAuthMessage(error.message, "error");
  }
}

async function refreshUserDirectory({ quiet = false } = {}) {
  if (!authState.enabled || !isCurrentUserAdmin()) {
    authState.users = [];
    renderUsers();
    return;
  }

  try {
    const { data, error } = await supabaseClient.from("user_profiles").select("*").order("email");
    if (error) throw error;
    authState.users = (data || []).map(normalizeProfile);
    renderUsers();
    if (!quiet) setUsersMessage("Users refreshed.", "ok");
  } catch (error) {
    console.error("Failed to load user directory.", error);
    if (!quiet) setUsersMessage("Unable to load users.", "error");
  }
}

async function invokeAdminUsersFunction(body) {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const headers = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
  const { data, error } = await supabaseClient.functions.invoke(HOSTED_CONFIG.adminUsersFunctionName, {
    body,
    headers,
  });
  if (error) {
    if (error.context) {
      try {
        const payload = await error.context.json();
        throw new Error(payload?.error || error.message);
      } catch {
        try {
          const text = await error.context.text();
          throw new Error(text || error.message);
        } catch {
          throw error;
        }
      }
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function onSaveUser(event) {
  event.preventDefault();
  if (!requireAdminAccess()) return;

  const displayName = userDisplayNameInput.value.trim();
  const email = userEmailInput.value.trim().toLowerCase();
  const password = userPasswordInput.value;
  const role = userRoleSelect.value === "admin" ? "admin" : "viewer";
  const canWriteOverride = userCanWriteOverrideEnabledInput.checked ? userCanWriteOverrideInput.checked : null;
  const tabOverrides = readUserTabOverrides();

  if (!displayName || !email) {
    setUsersMessage("Name and email are required.", "error");
    return;
  }
  if (!editState.userId && !password) {
    setUsersMessage("A password is required when adding a user.", "error");
    return;
  }

  try {
    const isEditing = Boolean(editState.userId);
    setUsersMessage(editState.userId ? "Saving user..." : "Creating user...", "ok");
    await invokeAdminUsersFunction({
      action: editState.userId ? "update_user" : "create_user",
      userId: editState.userId,
      displayName,
      email,
      password: password || null,
      role,
      canWriteOverride,
      tabOverrides,
    });
    await refreshUserDirectory({ quiet: true });
    if (editState.userId === authState.user?.id) {
      authState.profile = await loadCurrentUserProfile();
    }
    resetUserForm();
    renderAll();
    setUsersMessage(isEditing ? "User updated." : "User added.", "ok");
  } catch (error) {
    console.error("Failed to save user.", error);
    setUsersMessage(error.message || "Unable to save user.", "error");
  }
}

function resetUserForm() {
  editState.userId = null;
  userForm.reset();
  renderUserTabOverrideInputs();
  syncUserOverrideControls();
  syncEditorButtons();
}

function setAuthMessage(text, type) {
  authMessage.textContent = text;
  authMessage.className = text ? `message ${type}` : "message";
}

function setUsersMessage(text, type) {
  usersMessage.textContent = text;
  usersMessage.className = text ? `message ${type}` : "message";
}

function getPersistenceDb() {
  if (persistenceDbPromise) return persistenceDbPromise;
  persistenceDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.createObjectStore(INDEXED_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
  });
  return persistenceDbPromise;
}

function readPersistedState(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INDEXED_DB_STORE, "readonly");
    const store = transaction.objectStore(INDEXED_DB_STORE);
    const request = store.get(INDEXED_DB_RECORD_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Unable to read IndexedDB state."));
  });
}

function writePersistedState(db, nextState) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INDEXED_DB_STORE, "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Unable to write IndexedDB state."));
    const store = transaction.objectStore(INDEXED_DB_STORE);
    store.put(nextState, INDEXED_DB_RECORD_KEY);
  });
}

function loadLegacyLocalState() {
  for (const storageKey of LEGACY_LOCAL_STORAGE_KEYS) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      return structuredClone(defaultData);
    }
  }
  return null;
}

function clearLegacyLocalState() {
  for (const storageKey of LEGACY_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(storageKey);
  }
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

async function onSelectSeason() {
  const nextSeasonId = String(seasonSelect.value || "");
  if (!nextSeasonId || nextSeasonId === getCurrentSeasonId()) return;

  persistCurrentSeasonInStore();
  seasonStore.activeSeasonId = nextSeasonId;
  rememberActiveSeason(nextSeasonId);
  state = getSeasonStateById(nextSeasonId);
  await saveState();
  renderAll();
  setActiveTab("settings");
  setMessage(`Season opened: ${state.season.name}`, "ok");
}

async function createSeason(duplicateCurrent) {
  if (!requireWriteAccess()) return;

  const suggestedName = duplicateCurrent
    ? `${state.season.name} Copy`
    : defaultData.season.name;
  const seasonName = window.prompt(
    duplicateCurrent ? "New season name for the duplicated season:" : "New season name:",
    suggestedName
  )?.trim();
  if (!seasonName) return;

  persistCurrentSeasonInStore();
  const seasonId = id("season");
  const nextState = duplicateCurrent ? cloneCurrentState() : createSeasonState();
  nextState.season.name = seasonName;
  if (!duplicateCurrent) {
    nextState.season.notes = "";
  }

  seasonStore.seasons.push(seasonId);
  seasonStore.seasonStates[seasonId] = nextState;
  seasonStore.activeSeasonId = seasonId;
  rememberActiveSeason(seasonId);
  state = getSeasonStateById(seasonId);
  await saveState();
  renderAll();
  setActiveTab("settings");
  setMessage(duplicateCurrent ? `Season duplicated: ${seasonName}` : `Season created: ${seasonName}`, "ok");
}

function onSaveSeason(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  state.season.name = seasonNameInput.value.trim() || defaultData.season.name;
  state.season.notes = seasonNotesInput.value.trim();
  saveState();
  renderSeasonOptions();
  setMessage(`Season saved: ${state.season.name}`, "ok");
}

function onSaveSettings(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  state.settings.warmupMinutes = toPositiveInt(warmupMinutesInput.value, defaultData.settings.warmupMinutes);
  state.settings.packAwayMinutes = toPositiveInt(packawayMinutesInput.value, defaultData.settings.packAwayMinutes);
  state.settings.showVisualPlanner = showVisualPlannerInput.checked;
  saveState();
  renderMatchSlots();
  renderPlannerOutputs();
  syncVisualPlannerTab();
  setMessage("Global match settings saved.", "ok");
}

function onSaveSummerTrainingDateRange() {
  if (!requireTrainingWriteAccess()) {
    summerTrainingStartDateInput.value = state.settings.summerTrainingStartDate || "";
    summerTrainingEndDateInput.value = state.settings.summerTrainingEndDate || "";
    return;
  }
  const startDate = normalizeDateInput(summerTrainingStartDateInput.value);
  let endDate = normalizeDateInput(summerTrainingEndDateInput.value);
  if (startDate && endDate && endDate < startDate) {
    endDate = startDate;
  }
  state.settings.summerTrainingStartDate = startDate;
  state.settings.summerTrainingEndDate = endDate;
  summerTrainingStartDateInput.value = startDate;
  summerTrainingEndDateInput.value = endDate;
  saveState();
  renderSummerTrainingPlanner();
  renderFriendlyBookingPlanner();
  setTrainingMessage(
    startDate
      ? `Summer training will block friendly bookings ${formatSummerTrainingCalendarWindow()}.`
      : "Summer training calendar blocking is off until a start date is set.",
    "ok"
  );
}

function onSaveTeam(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  const formData = new FormData(teamForm);
  const payload = {
    name: formData.get("name").toString().trim(),
    ageGroup: formData.get("ageGroup").toString().trim(),
    colour: formData.get("colour").toString().trim(),
    format: formData.get("format").toString(),
    gender: formData.get("gender").toString(),
    matchDay: formData.get("matchDay").toString(),
    matchLengthMinutes: toPositiveInt(formData.get("matchLengthMinutes"), 60),
    kickoffPreference: normalizeKickoffPreference(formData.get("kickoffPreference")),
    winterTrainingAreas: normalizeWinterTrainingAreas(formData.get("winterTrainingAreas")),
    winterTrainingPreference: normalizeWinterTrainingPreference(formData.get("winterTrainingPreference")),
    manager: formData.get("manager").toString().trim(),
    assistantManager: formData.get("assistantManager").toString().trim(),
  };
  if (editState.teamId) {
    const team = state.teams.find((item) => item.id === editState.teamId);
    if (!team) return failEdit(resetTeamForm, "That team no longer exists.");
    Object.assign(team, payload);
    saveState();
    renderTeams();
    renderPlannerOutputs();
    renderWinterTrainingPlanner();
    renderSummerTrainingPlanner();
    renderFriendlyBookingPlanner();
    resetTeamForm();
    return setMessage("Team updated.", "ok");
  }
  state.teams.push({ id: id("team"), ...payload });
  saveState();
  renderTeams();
  renderPlannerOutputs();
  renderWinterTrainingPlanner();
  renderSummerTrainingPlanner();
  renderFriendlyBookingPlanner();
  resetTeamForm();
  setMessage("Team added.", "ok");
}

function onSaveVenue(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  const formData = new FormData(venueForm);
  const payload = {
    name: formData.get("name").toString().trim(),
    summerTrainingAreas: toPositiveInt(formData.get("summerTrainingAreas"), 0),
    address: formData.get("address").toString().trim(),
  };
  if (editState.venueId) {
    const venue = state.venues.find((item) => item.id === editState.venueId);
    if (!venue) return failEdit(resetVenueForm, "That venue no longer exists.");
    const issue = validateSummerVenueCapacity(venue.id, payload.summerTrainingAreas);
    if (issue) return setMessage(issue, "error");
    Object.assign(venue, payload);
    saveState();
    renderVenues();
    renderPitchVenueOptions();
    renderPitches();
    renderSlotPitchOptions();
    renderMatchSlots();
    renderPlannerOutputs();
    renderSummerTrainingPlanner();
    renderFriendlyBookingPlanner();
    resetVenueForm();
    return setMessage("Venue updated.", "ok");
  }
  state.venues.push({ id: id("venue"), ...payload });
  saveState();
  renderVenues();
  renderPitchVenueOptions();
  renderSlotPitchOptions();
  renderSummerTrainingPlanner();
  renderFriendlyBookingPlanner();
  resetVenueForm();
  setMessage("Venue added.", "ok");
}

function onSavePitch(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  const formData = new FormData(pitchForm);
  const formats = Array.from(pitchForm.elements.formats.selectedOptions).map((option) => option.value);
  if (!formats.length) return setMessage("Select at least one supported format for the pitch.", "error");
  const kickoffTimes = parseKickoffTimes(formData.get("kickoffTimes"));
  const slotDay = formData.get("slotDay").toString();
  const payload = {
    venueId: formData.get("venueId").toString(),
    name: formData.get("name").toString().trim(),
    usage: formData.get("usage").toString(),
    overlayGroup: formData.get("overlayGroup").toString().trim(),
    formats,
  };

  if (kickoffTimes.error) return setMessage(kickoffTimes.error, "error");
  if (kickoffTimes.values.length && !slotDay) {
    return setMessage("Choose a slot day when adding kickoff times to a pitch.", "error");
  }
  if (slotDay && !kickoffTimes.values.length) {
    return setMessage("Enter at least one kickoff time if a slot day is selected.", "error");
  }
  if (kickoffTimes.values.length && payload.usage === "Training") {
    return setMessage("Kickoff slots can only be created for match-capable pitches.", "error");
  }

  if (editState.pitchId) {
    const pitch = state.pitches.find((item) => item.id === editState.pitchId);
    if (!pitch) return failEdit(resetPitchForm, "That pitch no longer exists.");
    Object.assign(pitch, payload);
    const newSlots = buildPitchKickoffSlots(pitch.id, slotDay, kickoffTimes.values);
    const issue = validateBatchMatchSlots(newSlots, state.matchSlots);
    if (issue) return setMessage(issue, "error");
    if (newSlots.length) {
      state.matchSlots.push(...newSlots);
    }
    saveState();
    renderPitchVenueOptions(payload.venueId);
    renderPitches();
    renderSlotPitchOptions();
    renderMatchSlots();
    renderPlannerOutputs();
    renderFriendlyBookingPlanner();
    resetPitchForm();
    return setMessage(newSlots.length ? "Pitch updated and kickoff slots added." : "Pitch updated.", "ok");
  }
  const pitchId = id("pitch");
  const newSlots = buildPitchKickoffSlots(pitchId, slotDay, kickoffTimes.values);
  const issue = validateBatchMatchSlots(newSlots, state.matchSlots);
  if (issue) return setMessage(issue, "error");
  state.pitches.push({ id: pitchId, ...payload });
  if (newSlots.length) {
    state.matchSlots.push(...newSlots);
  }
  saveState();
  renderPitches();
  renderSlotPitchOptions();
  renderMatchSlots();
  renderPlannerOutputs();
  renderFriendlyBookingPlanner();
  resetPitchForm();
  setMessage(newSlots.length ? "Pitch added with kickoff slots." : "Pitch added.", "ok");
}

function onSaveSlot(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  const formData = new FormData(slotForm);
  const payload = {
    pitchId: formData.get("pitchId").toString(),
    day: formData.get("day").toString(),
    kickoffTime: formData.get("kickoffTime").toString(),
    label: formData.get("label").toString().trim(),
  };
  const slotId = editState.slotId || id("slot");
  const issue = validateMatchSlot({ id: slotId, ...payload }, editState.slotId);
  if (issue) return setMessage(issue, "error");
  if (editState.slotId) {
    const slot = state.matchSlots.find((item) => item.id === editState.slotId);
    if (!slot) return failEdit(resetSlotForm, "That slot no longer exists.");
    Object.assign(slot, payload);
    saveState();
    renderMatchSlots();
    renderPlannerOutputs();
    resetSlotForm();
    return setMessage("Home kickoff slot updated.", "ok");
  }
  state.matchSlots.push({ id: slotId, ...payload });
  saveState();
  renderMatchSlots();
  renderPlannerOutputs();
  resetSlotForm();
  setMessage("Home kickoff slot added.", "ok");
}

function validateMatchSlot(slot, ignoreSlotId = null) {
  if (!state.pitches.some((pitch) => pitch.id === slot.pitchId)) return "Choose a valid pitch for the slot.";
  if (!slot.kickoffTime) return "Choose a kickoff time for the slot.";
  if (!isValidLeagueKickoffTime(slot.kickoffTime)) {
    return `League kickoff slots cannot be earlier than ${toTimeString(LEAGUE_KICKOFF_MIN_MINUTES)}.`;
  }
  const duplicateKickoff = state.matchSlots.some((item) => {
    if (ignoreSlotId && item.id === ignoreSlotId) return false;
    if (item.pitchId !== slot.pitchId || item.day !== slot.day) return false;
    return item.kickoffTime === slot.kickoffTime;
  });
  return duplicateKickoff ? "That kickoff time already exists on the same pitch and day." : null;
}

function parseKickoffTimes(rawValue) {
  const values = String(rawValue || "")
    .split(/[\r\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const value of values) {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return { error: `Kickoff time "${value}" is not in HH:MM format.`, values: [] };
    }
    if (!isValidLeagueKickoffTime(value)) {
      return { error: `Kickoff time "${value}" is earlier than the league minimum of ${toTimeString(LEAGUE_KICKOFF_MIN_MINUTES)}.`, values: [] };
    }
  }

  return { error: null, values: [...new Set(values)].sort((a, b) => a.localeCompare(b)) };
}

function isValidLeagueKickoffTime(time) {
  const normalized = normalizeTimeInput(time);
  if (!normalized) return false;
  const minutes = toClockMinutes(normalized);
  return minutes >= LEAGUE_KICKOFF_MIN_MINUTES;
}

function buildPitchKickoffSlots(pitchId, day, kickoffTimes) {
  if (!day || !kickoffTimes.length) return [];
  return kickoffTimes.map((kickoffTime) => ({
    id: id("slot"),
    pitchId,
    day,
    kickoffTime,
    label: "",
  }));
}

function validateBatchMatchSlots(newSlots, existingSlots) {
  if (!newSlots.length) return null;

  const seen = new Set();
  for (const slot of newSlots) {
    const duplicateKey = `${slot.pitchId}|${slot.day}|${slot.kickoffTime}`;
    if (seen.has(duplicateKey)) {
      return `Kickoff time ${slot.kickoffTime} is duplicated in the batch for ${slot.day}.`;
    }
    seen.add(duplicateKey);

    const duplicateExisting = existingSlots.some(
      (item) => item.pitchId === slot.pitchId && item.day === slot.day && item.kickoffTime === slot.kickoffTime
    );
    if (duplicateExisting) {
      return `Kickoff time ${slot.kickoffTime} already exists on this pitch for ${slot.day}.`;
    }
  }

  return null;
}

function renderTeams() {
  teamsBody.innerHTML = "";
  const canWrite = canCurrentUserWrite();
  for (const team of sortTeams(state.teams)) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(team.name)} (${escapeHtml(team.colour)})</td>
      <td>${escapeHtml(team.ageGroup)}</td>
      <td>${escapeHtml(team.format)}</td>
      <td>${escapeHtml(team.gender)}</td>
      <td>${escapeHtml(team.matchDay)}</td>
      <td>${escapeHtml(`${team.matchLengthMinutes} mins`)}</td>
      <td>${escapeHtml(team.kickoffPreference)}</td>
      <td>${escapeHtml(String(team.winterTrainingAreas))}</td>
      <td>${escapeHtml(team.winterTrainingPreference)}</td>
      <td>${escapeHtml(team.manager)} / ${escapeHtml(team.assistantManager)}</td>
      <td class="row-actions">
        ${canWrite ? `
          <button class="secondary-btn" type="button" data-edit-team="${team.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-team="${team.id}">Delete</button>
        ` : ""}
      </td>`;
    teamsBody.appendChild(row);
  }
  bindRowActions(teamsBody, "edit-team", startEditTeam);
  bindRowActions(teamsBody, "delete-team", deleteTeam);
}

function renderVenues() {
  venuesBody.innerHTML = "";
  const canWrite = canCurrentUserWrite();
  for (const venue of [...state.venues].sort((a, b) => a.name.localeCompare(b.name))) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(venue.name)}</td>
      <td>${escapeHtml(String(venue.summerTrainingAreas || 0))}</td>
      <td>${escapeHtml(venue.address || "")}</td>
      <td class="row-actions">
        ${canWrite ? `
          <button class="secondary-btn" type="button" data-edit-venue="${venue.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-venue="${venue.id}">Delete</button>
        ` : ""}
      </td>`;
    venuesBody.appendChild(row);
  }
  bindRowActions(venuesBody, "edit-venue", startEditVenue);
  bindRowActions(venuesBody, "delete-venue", deleteVenue);
}
function renderPitchVenueOptions(selectedVenueId = pitchVenueSelect.value) {
  pitchVenueSelect.innerHTML = "";
  if (!state.venues.length) {
    pitchVenueSelect.innerHTML = `<option value="">Add a venue first</option>`;
    pitchVenueSelect.disabled = true;
    return;
  }
  pitchVenueSelect.disabled = false;
  for (const venue of [...state.venues].sort((a, b) => a.name.localeCompare(b.name))) {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = venue.name;
    pitchVenueSelect.appendChild(option);
  }
  if (state.venues.some((venue) => venue.id === selectedVenueId)) pitchVenueSelect.value = selectedVenueId;
}

function renderPitches() {
  pitchesBody.innerHTML = "";
  const canWrite = canCurrentUserWrite();
  for (const pitch of sortPitches(state.pitches)) {
    const venue = state.venues.find((item) => item.id === pitch.venueId);
    const overlay = pitch.overlayGroup ? ` / ${escapeHtml(pitch.overlayGroup)}` : "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${venue ? escapeHtml(venue.name) : "Unknown venue"}</td>
      <td>${escapeHtml(pitch.name)}</td>
      <td>${escapeHtml(pitch.usage)}</td>
      <td>${escapeHtml(pitch.formats.join(", "))}${overlay}</td>
      <td class="row-actions">
        ${canWrite ? `
          <button class="secondary-btn" type="button" data-edit-pitch="${pitch.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-pitch="${pitch.id}">Delete</button>
        ` : ""}
      </td>`;
    pitchesBody.appendChild(row);
  }
  bindRowActions(pitchesBody, "edit-pitch", startEditPitch);
  bindRowActions(pitchesBody, "delete-pitch", deletePitch);
}

function renderSlotPitchOptions(selectedPitchId = slotPitchSelect.value) {
  slotPitchSelect.innerHTML = "";
  const matchPitches = sortPitches(state.pitches.filter((pitch) => pitch.usage === "Both" || pitch.usage === "Match"));
  if (!matchPitches.length) {
    slotPitchSelect.innerHTML = `<option value="">Add a match-capable pitch first</option>`;
    slotPitchSelect.disabled = true;
    return;
  }
  slotPitchSelect.disabled = false;
  for (const pitch of matchPitches) {
    const venue = state.venues.find((item) => item.id === pitch.venueId);
    const option = document.createElement("option");
    option.value = pitch.id;
    option.textContent = `${venue ? venue.name : "Unknown"} - ${pitch.name}`;
    slotPitchSelect.appendChild(option);
  }
  if (matchPitches.some((pitch) => pitch.id === selectedPitchId)) slotPitchSelect.value = selectedPitchId;
}

function renderMatchSlots() {
  slotsBody.innerHTML = "";
  const canWrite = canCurrentUserWrite();
  for (const slot of sortMatchSlots(state.matchSlots)) {
    const pitch = state.pitches.find((item) => item.id === slot.pitchId);
    const venue = pitch ? state.venues.find((item) => item.id === pitch.venueId) : null;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(slot.day)}</td>
      <td>${escapeHtml(slot.kickoffTime)}</td>
      <td>${venue ? escapeHtml(venue.name) : "Unknown"} / ${pitch ? escapeHtml(pitch.name) : "Deleted pitch"}</td>
      <td>${escapeHtml(describeSlotCapacity(slot))}</td>
      <td>${escapeHtml((pitch?.formats || []).join(", ") || "No supported formats")}${slot.label ? `<div class="schedule-item__notes">Note: ${escapeHtml(slot.label)}</div>` : ""}</td>
      <td class="row-actions">
        ${canWrite ? `
          <button class="secondary-btn" type="button" data-edit-slot="${slot.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-slot="${slot.id}">Delete</button>
        ` : ""}
      </td>`;
    slotsBody.appendChild(row);
  }
  bindRowActions(slotsBody, "edit-slot", startEditSlot);
  bindRowActions(slotsBody, "delete-slot", deleteMatchSlot);
}

function renderFriendlyBookingPlanner() {
  renderFriendlyTeamOptions(editState.friendlyBookingId ? friendlyTeamSelect.value : "");
  renderFriendlyPitchOptions(editState.friendlyBookingId ? friendlyPitchSelect.value : "");
  renderPitchBlockPitchOptions(editState.pitchBlockId ? pitchBlockPitchSelect.value : "");
  if (!friendlyDateInput.value) friendlyDateInput.value = toDateInputValue(new Date());
  if (!friendlyKickoffInput.value) friendlyKickoffInput.value = "10:00";
  if (!pitchBlockStartDateInput.value) pitchBlockStartDateInput.value = friendlyDateInput.value || toDateInputValue(new Date());
  if (!pitchBlockEndDateInput.value) pitchBlockEndDateInput.value = pitchBlockStartDateInput.value;
  if (!pitchBlockStartInput.value) pitchBlockStartInput.value = "10:00";
  if (!pitchBlockEndInput.value) pitchBlockEndInput.value = "11:00";
  if (!friendlyCalendarMonthInput.value) friendlyCalendarMonthInput.value = toMonthInputValue(new Date());
  renderFriendlyDayBoard();
  renderFriendlyCalendar();
  syncEditorButtons();
}

function onFriendlyDateChange() {
  const date = normalizeDateInput(friendlyDateInput.value);
  if (date) friendlyCalendarMonthInput.value = date.slice(0, 7);
  renderFriendlyDayBoard();
  renderFriendlyCalendar();
}

function onPitchBlockDateChange() {
  const startDate = normalizeDateInput(pitchBlockStartDateInput.value);
  const endDate = normalizeDateInput(pitchBlockEndDateInput.value);
  if (startDate && (!endDate || endDate < startDate)) {
    pitchBlockEndDateInput.value = startDate;
  }
  if (startDate) {
    friendlyDateInput.value = startDate;
    friendlyCalendarMonthInput.value = startDate.slice(0, 7);
  }
  renderFriendlyDayBoard();
  renderFriendlyCalendar();
}

function renderFriendlyTeamOptions(selectedTeamId = friendlyTeamSelect.value) {
  friendlyTeamSelect.innerHTML = "";
  if (!state.teams.length) {
    friendlyTeamSelect.innerHTML = `<option value="">Add teams first</option>`;
    friendlyTeamSelect.disabled = true;
    return;
  }

  friendlyTeamSelect.disabled = !canCurrentUserEditFriendlies();
  friendlyTeamSelect.appendChild(new Option("Choose a team", ""));
  for (const team of sortTeams(state.teams)) {
    friendlyTeamSelect.appendChild(new Option(formatTeamDisplayName(team), team.id));
  }
  if (state.teams.some((team) => team.id === selectedTeamId)) {
    friendlyTeamSelect.value = selectedTeamId;
  }
}

function renderFriendlyPitchOptions(selectedPitchId = friendlyPitchSelect.value) {
  friendlyPitchSelect.innerHTML = "";
  const team = state.teams.find((item) => item.id === friendlyTeamSelect.value);
  if (!team) {
    friendlyPitchSelect.innerHTML = `<option value="">Choose a team first</option>`;
    friendlyPitchSelect.disabled = true;
    return;
  }
  const matchPitches = sortPitches(
    state.pitches.filter(
      (pitch) =>
        isMatchCapablePitch(pitch) &&
        pitch.formats.includes(team.format)
    )
  );

  if (!matchPitches.length) {
    friendlyPitchSelect.innerHTML = `<option value="">No suitable match pitch</option>`;
    friendlyPitchSelect.disabled = true;
    return;
  }

  friendlyPitchSelect.disabled = !canCurrentUserEditFriendlies();
  friendlyPitchSelect.appendChild(new Option("Choose a pitch", ""));
  for (const pitch of matchPitches) {
    const overlay = pitch.overlayGroup ? `, overlay ${pitch.overlayGroup}` : "";
    friendlyPitchSelect.appendChild(
      new Option(`${getVenueName(pitch.venueId)} - ${pitch.name} (${pitch.formats.join(", ")}${overlay})`, pitch.id)
    );
  }
  if (matchPitches.some((pitch) => pitch.id === selectedPitchId)) {
    friendlyPitchSelect.value = selectedPitchId;
    plannerUiState.friendlyPendingPitchId = selectedPitchId;
  }
}

function renderPitchBlockPitchOptions(selectedPitchId = pitchBlockPitchSelect.value) {
  pitchBlockPitchSelect.innerHTML = "";
  const matchPitches = sortPitches(state.pitches.filter(isMatchCapablePitch));
  if (!matchPitches.length) {
    pitchBlockPitchSelect.innerHTML = `<option value="">Add a match-capable pitch first</option>`;
    pitchBlockPitchSelect.disabled = true;
    return;
  }

  pitchBlockPitchSelect.disabled = !canCurrentUserWrite();
  pitchBlockPitchSelect.appendChild(new Option("Choose a pitch", ""));
  for (const pitch of matchPitches) {
    const overlay = pitch.overlayGroup ? `, overlay ${pitch.overlayGroup}` : "";
    pitchBlockPitchSelect.appendChild(
      new Option(`${getVenueName(pitch.venueId)} - ${pitch.name} (${pitch.formats.join(", ")}${overlay})`, pitch.id)
    );
  }
  if (matchPitches.some((pitch) => pitch.id === selectedPitchId)) {
    pitchBlockPitchSelect.value = selectedPitchId;
  }
}

function onSaveFriendlyBooking(event) {
  event.preventDefault();
  if (!requireFriendlyWriteAccess()) return;

  const formData = new FormData(friendlyBookingForm);
  const bookingId = editState.friendlyBookingId || id("friendly");
  const payload = {
    teamId: formData.get("teamId").toString(),
    pitchId: formData.get("pitchId").toString(),
    date: normalizeDateInput(formData.get("date")),
    kickoffTime: normalizeTimeInput(formData.get("kickoffTime")),
    durationMinutes: toPositiveInt(formData.get("durationMinutes"), 90),
    opponent: formData.get("opponent").toString().trim(),
    notes: formData.get("notes").toString().trim(),
  };
  const booking = { id: bookingId, ...payload };
  const issue = validateFriendlyBooking(booking, editState.friendlyBookingId);
  if (issue) return setFriendlyMessage(issue, "error");

  if (editState.friendlyBookingId) {
    const existing = state.friendlyBookings.find((item) => item.id === editState.friendlyBookingId);
    if (!existing) {
      resetFriendlyBookingForm();
      return setFriendlyMessage("That friendly booking no longer exists.", "error");
    }
    Object.assign(existing, payload);
    saveState({ allowFriendliesWrite: true });
    resetFriendlyBookingForm({ keepMessage: true });
    renderFriendlyBookingPlanner();
    return setFriendlyMessage("Friendly booking updated.", "ok");
  }

  state.friendlyBookings.push(booking);
  saveState({ allowFriendliesWrite: true });
  resetFriendlyBookingForm({ keepMessage: true });
  renderFriendlyBookingPlanner();
  setFriendlyMessage("Friendly booking added.", "ok");
}

function onSavePitchBlock(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;

  const formData = new FormData(pitchBlockForm);
  const blockId = editState.pitchBlockId || id("block");
  const payload = {
    pitchId: formData.get("pitchId").toString(),
    startDate: normalizeDateInput(formData.get("startDate")),
    endDate: normalizeDateInput(formData.get("endDate")),
    startTime: normalizeTimeInput(formData.get("startTime")),
    endTime: normalizeTimeInput(formData.get("endTime")),
    reason: formData.get("reason").toString().trim(),
  };
  const block = { id: blockId, ...payload };
  const issue = validatePitchBlock(block, editState.pitchBlockId);
  if (issue) return setFriendlyMessage(issue, "error");
  friendlyDateInput.value = payload.startDate;
  friendlyCalendarMonthInput.value = payload.startDate.slice(0, 7);

  if (editState.pitchBlockId) {
    const existing = state.pitchBlocks.find((item) => item.id === editState.pitchBlockId);
    if (!existing) {
      resetPitchBlockForm();
      return setFriendlyMessage("That pitch block no longer exists.", "error");
    }
    Object.assign(existing, payload);
    saveState();
    resetPitchBlockForm({ keepMessage: true });
    renderFriendlyBookingPlanner();
    return setFriendlyMessage("Pitch block updated.", "ok");
  }

  state.pitchBlocks.push(block);
  saveState();
  resetPitchBlockForm({ keepMessage: true });
  renderFriendlyBookingPlanner();
  setFriendlyMessage("Pitch block added.", "ok");
}

function validateFriendlyBooking(booking, ignoreBookingId = null) {
  const team = state.teams.find((item) => item.id === booking.teamId);
  const pitch = state.pitches.find((item) => item.id === booking.pitchId);
  if (!team) return "Choose a valid team for the friendly.";
  if (!pitch) return "Choose a valid pitch for the friendly.";
  if (!isMatchCapablePitch(pitch)) return "Choose a match-capable pitch for the friendly.";
  if (!pitch.formats.includes(team.format)) return `${pitch.name} does not support ${team.format} matches.`;
  if (!booking.date) return "Choose a valid date for the friendly.";
  if (!booking.kickoffTime) return "Choose a valid kickoff time for the friendly.";
  if (!booking.durationMinutes || booking.durationMinutes < 15) return "Choose a realistic match duration.";
  const bookingRange = friendlyBookingToRange(booking);

  const teamConflict = state.friendlyBookings.find((existing) => {
    if (ignoreBookingId && existing.id === ignoreBookingId) return false;
    return existing.teamId === booking.teamId && friendlyBookingTimesOverlap(booking, existing);
  });
  if (teamConflict) {
    const conflictDetails = getFriendlyBookingDetails(teamConflict);
    return `${formatTeamDisplayName(team)} already has a friendly booked from ${teamConflict.kickoffTime} to ${conflictDetails.endTime}.`;
  }

  const blockConflict = [
    ...state.pitchBlocks,
    ...getSummerTrainingBlocksForDate(booking.date),
  ].find((block) => pitchBlockConflictsWithRange(block, pitch, bookingRange));
  if (blockConflict) {
    const blockPitch = state.pitches.find((item) => item.id === blockConflict.pitchId);
    const blockType = blockConflict.source === "summer-training" ? "reserved" : "blocked";
    return `${blockPitch?.name || "This pitch"} is ${blockType} from ${blockConflict.startTime} to ${blockConflict.endTime}${blockConflict.reason ? ` for ${blockConflict.reason}` : ""}.`;
  }

  const conflict = state.friendlyBookings.find((existing) => {
    if (ignoreBookingId && existing.id === ignoreBookingId) return false;
    return friendlyBookingsConflict(booking, existing);
  });

  if (!conflict) return null;
  const conflictDetails = getFriendlyBookingDetails(conflict);
  const conflictTeam = formatTeamDisplayName(conflictDetails.team) || "Another team";
  const conflictPitch = conflictDetails.pitch
    ? `${getVenueName(conflictDetails.pitch.venueId)} - ${conflictDetails.pitch.name}`
    : "a deleted pitch";
  return `${conflictTeam} already has ${conflictPitch} booked from ${conflict.kickoffTime} to ${conflictDetails.endTime}.`;
}

function validatePitchBlock(block, ignoreBlockId = null) {
  const pitch = state.pitches.find((item) => item.id === block.pitchId);
  if (!pitch) return "Choose a valid pitch to block.";
  if (!getPitchBlockStartDate(block)) return "Choose a valid start date for the pitch block.";
  if (!getPitchBlockEndDate(block)) return "Choose a valid end date for the pitch block.";
  if (getPitchBlockEndDate(block) < getPitchBlockStartDate(block)) return "Pitch block end date must be on or after the start date.";
  if (!block.startTime || !block.endTime) return "Choose valid start and end times for the pitch block.";
  const range = pitchBlockToRange(block);
  if (!range || range.end <= range.start) return "Pitch block end time must be after the start time.";

  const bookingConflict = state.friendlyBookings.find((booking) => {
    const bookingPitch = state.pitches.find((item) => item.id === booking.pitchId);
    return bookingPitch && pitchBlockConflictsWithRange(block, bookingPitch, friendlyBookingToRange(booking));
  });
  if (bookingConflict) {
    const { team, endTime } = getFriendlyBookingDetails(bookingConflict);
    return `${formatTeamDisplayName(team) || "A team"} already has a friendly booked from ${bookingConflict.kickoffTime} to ${endTime}.`;
  }

  const blockConflict = state.pitchBlocks.find((existing) => {
    if (ignoreBlockId && existing.id === ignoreBlockId) return false;
    const existingPitch = state.pitches.find((item) => item.id === existing.pitchId);
    return existingPitch && pitchBlockConflictsWithRange(block, existingPitch, pitchBlockToRange(existing));
  });
  if (blockConflict) {
    const blockPitch = state.pitches.find((item) => item.id === blockConflict.pitchId);
    return `${blockPitch?.name || "That pitch"} already has a block from ${formatPitchBlockDateRange(blockConflict)} ${blockConflict.startTime} to ${blockConflict.endTime}.`;
  }

  const trainingConflict = getDatesInRange(range.startDate, range.endDate)
    .flatMap((date) => getSummerTrainingBlocksForDate(date))
    .find((existing) => pitchBlockConflictsWithRange(existing, pitch, range));
  if (trainingConflict) {
    const blockPitch = state.pitches.find((item) => item.id === trainingConflict.pitchId);
    return `${blockPitch?.name || "That pitch"} is already reserved for summer training on ${formatDateLabel(trainingConflict.date)} from ${trainingConflict.startTime} to ${trainingConflict.endTime}.`;
  }

  return null;
}

function friendlyBookingsConflict(bookingA, bookingB) {
  if (bookingA.date !== bookingB.date) return false;
  const pitchA = state.pitches.find((pitch) => pitch.id === bookingA.pitchId);
  const pitchB = state.pitches.find((pitch) => pitch.id === bookingB.pitchId);
  if (!pitchA || !pitchB) return false;
  if (!pitchesSharePhysicalSpace(pitchA, pitchB)) return false;
  return friendlyBookingTimesOverlap(bookingA, bookingB);
}

function friendlyBookingToRange(booking) {
  const start = toClockMinutes(booking.kickoffTime);
  if (!Number.isFinite(start)) return null;
  return {
    date: booking.date,
    startDate: booking.date,
    endDate: booking.date,
    start,
    end: start + booking.durationMinutes,
  };
}

function pitchBlockToRange(block) {
  const startDate = getPitchBlockStartDate(block);
  const endDate = getPitchBlockEndDate(block);
  const start = toClockMinutes(block.startTime);
  const end = toClockMinutes(block.endTime);
  if (!startDate || !endDate || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  return {
    date: startDate,
    startDate,
    endDate,
    start,
    end,
  };
}

function pitchBlockConflictsWithRange(block, targetPitch, range) {
  if (!range) return false;
  const blockPitch = state.pitches.find((pitch) => pitch.id === block.pitchId);
  if (!blockPitch || !targetPitch || !pitchesSharePhysicalSpace(blockPitch, targetPitch)) return false;
  const blockRange = pitchBlockToRange(block);
  if (!blockRange || blockRange.end <= blockRange.start) return false;
  const rangeStartDate = range.startDate || range.date;
  const rangeEndDate = range.endDate || range.date;
  if (!dateRangesOverlap(blockRange.startDate, blockRange.endDate, rangeStartDate, rangeEndDate)) return false;
  return timesOverlap(blockRange.start, blockRange.end, range.start, range.end);
}

function getPitchBlockStartDate(block) {
  return normalizeDateInput(block?.startDate || block?.date);
}

function getPitchBlockEndDate(block) {
  return normalizeDateInput(block?.endDate || block?.date) || getPitchBlockStartDate(block);
}

function pitchBlockCoversDate(block, date) {
  const startDate = getPitchBlockStartDate(block);
  const endDate = getPitchBlockEndDate(block);
  return Boolean(date && startDate && endDate && startDate <= date && date <= endDate);
}

function dateRangesOverlap(startA, endA, startB, endB) {
  return Boolean(startA && endA && startB && endB && startA <= endB && startB <= endA);
}

function formatPitchBlockDateRange(block) {
  const startDate = getPitchBlockStartDate(block);
  const endDate = getPitchBlockEndDate(block);
  if (!startDate) return "";
  if (!endDate || endDate === startDate) return formatDateLabel(startDate);
  return `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`;
}

function getSummerTrainingBlocksForDate(dateValue) {
  const date = normalizeDateInput(dateValue);
  const startDate = normalizeDateInput(state.settings.summerTrainingStartDate);
  const endDate = normalizeDateInput(state.settings.summerTrainingEndDate);
  if (!date || !startDate || date < startDate || (endDate && date > endDate)) return [];

  const day = getDayNameForDate(date);
  if (!WINTER_TRAINING_DAYS.includes(day)) return [];

  const blocks = [];
  for (const venue of getSummerEnabledVenues()) {
    const venuePitches = getSummerTrainingBlockPitches(venue.id);
    if (!venuePitches.length) continue;

    for (const time of WINTER_TRAINING_TIMES) {
      const groups = groupTrainingAssignments(getSummerAssignmentsForSlot(venue.id, day, time));
      const areasUsed = getTrainingGroupsAreaUsage(groups);
      if (areasUsed < 1) continue;

      const pitchCount = Math.min(Math.ceil(areasUsed / 2), venuePitches.length);
      const startMinutes = toClockMinutes(time);
      const endTime = Number.isFinite(startMinutes) ? toTimeString(startMinutes + 60) : "";
      const reason = `Summer training (${areasUsed} area${areasUsed === 1 ? "" : "s"})`;

      for (const pitch of venuePitches.slice(0, pitchCount)) {
        blocks.push({
          id: `summer-training|${date}|${venue.id}|${time}|${pitch.id}`,
          pitchId: pitch.id,
          date,
          startTime: time,
          endTime,
          reason,
          source: "summer-training",
        });
      }
    }
  }

  return blocks.sort((a, b) => a.startTime.localeCompare(b.startTime) || getPitchLabel(a.pitchId).localeCompare(getPitchLabel(b.pitchId)));
}

function formatSummerTrainingCalendarWindow() {
  const startDate = normalizeDateInput(state.settings.summerTrainingStartDate);
  const endDate = normalizeDateInput(state.settings.summerTrainingEndDate);
  if (!startDate) return "";
  if (!endDate) return `from ${formatDateLabel(startDate)}`;
  if (endDate === startDate) return `on ${formatDateLabel(startDate)}`;
  return `from ${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}`;
}

function getSummerTrainingBlockPitches(venueId) {
  const physicalSpaces = new Set();
  return sortPitches(state.pitches.filter((pitch) => pitch.venueId === venueId && isMatchCapablePitch(pitch)))
    .filter((pitch) => {
      const physicalKey = pitch.overlayGroup ? `overlay:${pitch.overlayGroup}` : `pitch:${pitch.id}`;
      if (physicalSpaces.has(physicalKey)) return false;
      physicalSpaces.add(physicalKey);
      return true;
    });
}

function getDayNameForDate(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return DAYS[(date.getDay() + 6) % 7] || "";
}

function getPitchLabel(pitchId) {
  const pitch = state.pitches.find((item) => item.id === pitchId);
  return pitch ? `${getVenueName(pitch.venueId)} ${pitch.name}` : "";
}

function friendlyBookingTimesOverlap(bookingA, bookingB) {
  if (bookingA.date !== bookingB.date) return false;
  const startA = toClockMinutes(bookingA.kickoffTime);
  const startB = toClockMinutes(bookingB.kickoffTime);
  if (!Number.isFinite(startA) || !Number.isFinite(startB)) return false;
  return timesOverlap(
    startA,
    startA + bookingA.durationMinutes,
    startB,
    startB + bookingB.durationMinutes
  );
}

function pitchesSharePhysicalSpace(pitchA, pitchB) {
  if (pitchA.id === pitchB.id) return true;
  if (pitchA.venueId !== pitchB.venueId) return false;
  if (!pitchA.overlayGroup || !pitchB.overlayGroup) return false;
  return pitchA.overlayGroup === pitchB.overlayGroup;
}

function getFriendlyBookingDetails(booking) {
  const team = state.teams.find((item) => item.id === booking.teamId) || null;
  const pitch = state.pitches.find((item) => item.id === booking.pitchId) || null;
  const startMinutes = toClockMinutes(booking.kickoffTime);
  const endTime = Number.isFinite(startMinutes)
    ? toTimeString(startMinutes + booking.durationMinutes)
    : "";
  return { team, pitch, endTime };
}

function renderFriendlyDayBoard() {
  if (!friendlyDayBoard) return;
  const selectedDate = normalizeDateInput(friendlyDateInput.value) || toDateInputValue(new Date());
  const matchPitches = sortPitches(state.pitches.filter(isMatchCapablePitch));
  const dayBookings = state.friendlyBookings
    .filter((booking) => booking.date === selectedDate)
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
  const dayBlocks = [
    ...state.pitchBlocks.filter((block) => pitchBlockCoversDate(block, selectedDate)),
    ...getSummerTrainingBlocksForDate(selectedDate),
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (!matchPitches.length) {
    friendlyDayBoard.innerHTML = `<p class="empty-state">Add match-capable pitches in Venue Pitches to build the daily availability board.</p>`;
    return;
  }

  const slots = buildFriendlyDaySlots();
  const gridTemplate = `minmax(190px, 230px) repeat(${slots.length}, var(--friendly-time-slot-width))`;
  friendlyDayBoard.innerHTML = `
    <section class="friendly-day-board__panel">
      <div class="friendly-day-board__header">
        <h3>${escapeHtml(formatDateLabel(selectedDate))}</h3>
        <div class="friendly-day-board__legend" aria-label="Day board legend">
          <span><i class="is-available"></i> Available</span>
          <span><i class="is-booked"></i> Booked</span>
          <span><i class="is-maintenance"></i> Blocked</span>
          <span><i class="is-training"></i> Summer training</span>
          <span><i class="is-blocked"></i> Overlay blocked</span>
        </div>
      </div>
      <div class="friendly-day-board__scroll">
        <div class="friendly-day-board__grid">
          <div class="friendly-day-board__time-row" style="grid-template-columns: ${gridTemplate};">
            <div class="friendly-day-board__pitch-heading" style="grid-column: 1;">Pitch</div>
            ${slots.map((slot, index) => `
              <div class="friendly-day-board__time${slot.minutes % 60 === 0 ? "" : " is-half-hour"}" style="grid-column: ${index + 2};">
                ${slot.minutes % 60 === 0 ? escapeHtml(slot.label) : ""}
              </div>
            `).join("")}
          </div>
          ${matchPitches.map((pitch) => renderFriendlyPitchDayRow(pitch, slots, dayBookings, dayBlocks, gridTemplate, selectedDate)).join("")}
        </div>
      </div>
    </section>
  `;
  bindRowActions(friendlyDayBoard, "edit-friendly", startEditFriendlyBooking);
  bindRowActions(friendlyDayBoard, "delete-friendly", deleteFriendlyBooking);
  bindRowActions(friendlyDayBoard, "edit-pitch-block", startEditPitchBlock);
  bindRowActions(friendlyDayBoard, "delete-pitch-block", deletePitchBlock);
  bindRowActions(friendlyDayBoard, "select-friendly-slot", selectFriendlySlot);
}

function buildFriendlyDaySlots() {
  const slots = [];
  for (let minutes = FRIENDLY_DAY_START_MINUTES; minutes < FRIENDLY_DAY_END_MINUTES; minutes += FRIENDLY_DAY_SLOT_MINUTES) {
    slots.push({ minutes, label: toTimeString(minutes) });
  }
  return slots;
}

function renderFriendlyPitchDayRow(pitch, slots, dayBookings, dayBlocks, gridTemplate, selectedDate) {
  const canBookFriendlies = canCurrentUserEditFriendlies();
  const pitchBookings = dayBookings.filter((booking) => {
    const bookingPitch = state.pitches.find((item) => item.id === booking.pitchId);
    return bookingPitch && pitchesSharePhysicalSpace(pitch, bookingPitch);
  });
  const exactPitchBookings = pitchBookings.filter((booking) => booking.pitchId === pitch.id);
  const pitchBlocks = dayBlocks.filter((block) => pitchBlockConflictsWithRange(block, pitch, {
    date: selectedDate,
    start: 0,
    end: 24 * 60,
  }));
  const exactPitchBlocks = pitchBlocks.filter((block) => block.pitchId === pitch.id);

  return `
    <div class="friendly-day-board__row" style="grid-template-columns: ${gridTemplate};">
      <div class="friendly-day-board__pitch-label" style="grid-column: 1;">
        <strong>${escapeHtml(pitch.name)}</strong>
        <span>${escapeHtml(getVenueName(pitch.venueId))}</span>
        <small>${escapeHtml(pitch.formats.join(", "))}${pitch.overlayGroup ? ` / ${escapeHtml(pitch.overlayGroup)}` : ""}</small>
      </div>
      ${slots.map((slot, index) => {
        const marker = getFriendlyPitchSlotMarker(pitch, slot.minutes, pitchBookings, pitchBlocks);
        const title = marker === "is-available"
          ? `Select ${pitch.name} at ${slot.label}`
          : describeFriendlyPitchSlotMarker(marker);
        if (marker === "is-available" && canBookFriendlies) {
          return `<button class="friendly-day-board__slot ${marker}" type="button" style="grid-column: ${index + 2};" data-select-friendly-slot="${pitch.id}|${slot.label}" title="${escapeHtml(title)}"></button>`;
        }
        return `<div class="friendly-day-board__slot ${marker}" style="grid-column: ${index + 2};" title="${escapeHtml(title)}"></div>`;
      }).join("")}
      ${exactPitchBookings.map((booking) => renderFriendlyDayBookingBlock(booking)).join("")}
      ${exactPitchBlocks.map((block) => renderPitchBlockDayBlock(block)).join("")}
    </div>
  `;
}

function getFriendlyPitchSlotMarker(pitch, slotStart, pitchBookings, pitchBlocks = []) {
  const slotEnd = slotStart + FRIENDLY_DAY_SLOT_MINUTES;
  const conflict = pitchBookings.find((booking) => {
    const bookingPitch = state.pitches.find((item) => item.id === booking.pitchId);
    const bookingStart = toClockMinutes(booking.kickoffTime);
    if (!bookingPitch || !Number.isFinite(bookingStart)) return false;
    return timesOverlap(slotStart, slotEnd, bookingStart, bookingStart + booking.durationMinutes);
  });
  if (conflict) return conflict.pitchId === pitch.id ? "is-booked" : "is-blocked";

  const block = pitchBlocks.find((item) => {
    const range = pitchBlockToRange(item);
    return range && timesOverlap(slotStart, slotEnd, range.start, range.end);
  });
  if (!block) return "is-available";
  if (block.pitchId !== pitch.id) return "is-blocked";
  return block.source === "summer-training" ? "is-training" : "is-maintenance";
}

function describeFriendlyPitchSlotMarker(marker) {
  if (marker === "is-booked") return "Booked";
  if (marker === "is-maintenance") return "Pitch blocked";
  if (marker === "is-training") return "Reserved for summer training";
  if (marker === "is-blocked") return "Unavailable because an overlayed pitch is booked";
  return "Available";
}

function renderFriendlyDayBookingBlock(booking) {
  const { team, endTime } = getFriendlyBookingDetails(booking);
  const startMinutes = toClockMinutes(booking.kickoffTime);
  if (!Number.isFinite(startMinutes)) return "";

  const clampedStart = Math.max(startMinutes, FRIENDLY_DAY_START_MINUTES);
  const clampedEnd = Math.min(startMinutes + booking.durationMinutes, FRIENDLY_DAY_END_MINUTES);
  if (clampedEnd <= FRIENDLY_DAY_START_MINUTES || clampedStart >= FRIENDLY_DAY_END_MINUTES) return "";

  const startIndex = Math.floor((clampedStart - FRIENDLY_DAY_START_MINUTES) / FRIENDLY_DAY_SLOT_MINUTES);
  const endIndex = Math.ceil((clampedEnd - FRIENDLY_DAY_START_MINUTES) / FRIENDLY_DAY_SLOT_MINUTES);
  const canWrite = canCurrentUserEditFriendlies();
  const opponent = booking.opponent ? ` v ${booking.opponent}` : "";
  return `
    <article class="friendly-day-board__booking" style="grid-column: ${startIndex + 2} / ${endIndex + 2};">
      <strong>${escapeHtml(booking.kickoffTime)}-${escapeHtml(endTime)}</strong>
      <span>${escapeHtml(formatTeamDisplayName(team) || "Deleted team")}${escapeHtml(opponent)}</span>
      ${canWrite ? `
        <div class="friendly-day-board__actions">
          <button class="secondary-btn" type="button" data-edit-friendly="${booking.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-friendly="${booking.id}">Del</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderPitchBlockDayBlock(block) {
  const pitch = state.pitches.find((item) => item.id === block.pitchId);
  const range = pitchBlockToRange(block);
  if (!pitch || !range) return "";

  const clampedStart = Math.max(range.start, FRIENDLY_DAY_START_MINUTES);
  const clampedEnd = Math.min(range.end, FRIENDLY_DAY_END_MINUTES);
  if (clampedEnd <= FRIENDLY_DAY_START_MINUTES || clampedStart >= FRIENDLY_DAY_END_MINUTES) return "";

  const startIndex = Math.floor((clampedStart - FRIENDLY_DAY_START_MINUTES) / FRIENDLY_DAY_SLOT_MINUTES);
  const endIndex = Math.ceil((clampedEnd - FRIENDLY_DAY_START_MINUTES) / FRIENDLY_DAY_SLOT_MINUTES);
  const canWrite = canCurrentUserWrite() && block.source !== "summer-training";
  const blockClass = block.source === "summer-training" ? "is-training" : "is-maintenance";
  const label = block.reason || (block.source === "summer-training" ? "Summer training" : "Pitch blocked");
  return `
    <article class="friendly-day-board__booking ${blockClass}" style="grid-column: ${startIndex + 2} / ${endIndex + 2};">
      <strong>${escapeHtml(block.startTime)}-${escapeHtml(block.endTime)}</strong>
      <span>${escapeHtml(label)}</span>
      ${canWrite ? `
        <div class="friendly-day-board__actions">
          <button class="secondary-btn" type="button" data-edit-pitch-block="${block.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-pitch-block="${block.id}">Del</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderFriendlyCalendar() {
  if (!friendlyCalendar) return;
  const monthValue = friendlyCalendarMonthInput.value || toMonthInputValue(new Date());
  const monthMatch = monthValue.match(/^(\d{4})-(\d{2})$/);
  if (!monthMatch) {
    friendlyCalendar.innerHTML = `<p class="empty-state">Choose a valid month to view friendly bookings.</p>`;
    return;
  }

  const year = Number(monthMatch[1]);
  const monthIndex = Number(monthMatch[2]) - 1;
  const firstOfMonth = new Date(year, monthIndex, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstGridDay = new Date(year, monthIndex, 1 - startOffset);
  const bookingsByDate = groupFriendlyBookingsByDate(monthValue);
  const blocksByDate = groupPitchBlocksByDate(monthValue);
  const selectedDate = normalizeDateInput(friendlyDateInput.value);

  const dayNameHtml = DAYS.map((day) => `<div class="friendly-calendar__day-name">${escapeHtml(day.slice(0, 3))}</div>`).join("");
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(firstGridDay);
    cellDate.setDate(firstGridDay.getDate() + index);
    const dateKey = toDateInputValue(cellDate);
    const isOutside = cellDate.getMonth() !== monthIndex;
    const bookings = bookingsByDate.get(dateKey) || [];
    const blocks = blocksByDate.get(dateKey) || [];
    cells.push(`
      <div class="friendly-calendar__cell${isOutside ? " is-outside" : ""}${dateKey === selectedDate ? " is-selected" : ""}">
        <button class="friendly-calendar__date" type="button" data-select-friendly-date="${dateKey}">${cellDate.getDate()}</button>
        ${bookings.map(renderFriendlyBookingCard).join("")}
        ${blocks.map(renderPitchBlockCalendarCard).join("")}
      </div>
    `);
  }

  friendlyCalendar.innerHTML = `
    <div class="table-wrap">
      <div class="friendly-calendar__grid">
        ${dayNameHtml}
        ${cells.join("")}
      </div>
    </div>
  `;
  bindRowActions(friendlyCalendar, "edit-friendly", startEditFriendlyBooking);
  bindRowActions(friendlyCalendar, "delete-friendly", deleteFriendlyBooking);
  bindRowActions(friendlyCalendar, "edit-pitch-block", startEditPitchBlock);
  bindRowActions(friendlyCalendar, "delete-pitch-block", deletePitchBlock);
  bindRowActions(friendlyCalendar, "select-friendly-date", selectFriendlyDate);
}

function selectFriendlyDate(date) {
  const selectedDate = normalizeDateInput(date);
  if (!selectedDate) return;
  friendlyDateInput.value = selectedDate;
  friendlyCalendarMonthInput.value = selectedDate.slice(0, 7);
  renderFriendlyDayBoard();
  renderFriendlyCalendar();
}

function selectFriendlySlot(value) {
  if (!canCurrentUserEditFriendlies()) return;
  const [pitchId, kickoffTime] = String(value || "").split("|");
  const pitch = state.pitches.find((item) => item.id === pitchId);
  const time = normalizeTimeInput(kickoffTime);
  if (!pitch || !time) return;

  plannerUiState.friendlyPendingPitchId = pitchId;
  if (!friendlyDateInput.value) friendlyDateInput.value = toDateInputValue(new Date());
  friendlyKickoffInput.value = time;
  renderFriendlyPitchOptions(pitchId);

  const canSelectPitch = !friendlyPitchSelect.disabled &&
    Array.from(friendlyPitchSelect.options).some((option) => option.value === pitchId);
  if (canSelectPitch) {
    friendlyPitchSelect.value = pitchId;
    setFriendlyMessage(`${pitch.name} selected at ${time}.`, "ok");
  } else {
    setFriendlyMessage(`${pitch.name} at ${time} selected. Choose a compatible team to complete the pitch selection.`, "ok");
  }
}

function groupFriendlyBookingsByDate(monthValue) {
  const byDate = new Map();
  for (const booking of state.friendlyBookings) {
    if (!booking.date.startsWith(monthValue)) continue;
    if (!byDate.has(booking.date)) byDate.set(booking.date, []);
    byDate.get(booking.date).push(booking);
  }
  for (const bookings of byDate.values()) {
    bookings.sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
  }
  return byDate;
}

function groupPitchBlocksByDate(monthValue) {
  const byDate = new Map();
  const [year, month] = monthValue.split("-").map(Number);
  const daysInMonth = Number.isFinite(year) && Number.isFinite(month)
    ? new Date(year, month, 0).getDate()
    : 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const manualBlocks = state.pitchBlocks.filter((block) => pitchBlockCoversDate(block, date));
    if (manualBlocks.length) {
      byDate.set(date, manualBlocks);
    }
    const trainingBlocks = getSummerTrainingBlocksForDate(date);
    if (!trainingBlocks.length) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(...trainingBlocks);
  }
  for (const blocks of byDate.values()) {
    blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return byDate;
}

function renderFriendlyBookingCard(booking) {
  const { team, pitch, endTime } = getFriendlyBookingDetails(booking);
  const canWrite = canCurrentUserEditFriendlies();
  const opponent = booking.opponent ? ` v ${booking.opponent}` : "";
  const venueName = pitch ? getVenueName(pitch.venueId) : "Deleted venue";
  const pitchName = pitch ? pitch.name : "Deleted pitch";
  return `
    <article class="friendly-booking-card">
      <strong>${escapeHtml(booking.kickoffTime)}-${escapeHtml(endTime)}</strong>
      <span>${escapeHtml(formatTeamDisplayName(team) || "Deleted team")}${escapeHtml(opponent)}</span>
      <small>${escapeHtml(venueName)} / ${escapeHtml(pitchName)}</small>
      ${booking.notes ? `<small>${escapeHtml(booking.notes)}</small>` : ""}
      ${canWrite ? `
        <div class="friendly-booking-actions">
          <button class="secondary-btn" type="button" data-edit-friendly="${booking.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-friendly="${booking.id}">Delete</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderPitchBlockCalendarCard(block) {
  const pitch = state.pitches.find((item) => item.id === block.pitchId);
  const canWrite = canCurrentUserWrite() && block.source !== "summer-training";
  const blockClass = block.source === "summer-training" ? "is-training" : "is-maintenance";
  const label = block.reason || (block.source === "summer-training" ? "Summer training" : "Pitch blocked");
  const dateRange = block.source === "summer-training" ? "" : formatPitchBlockDateRange(block);
  return `
    <article class="friendly-booking-card ${blockClass}">
      <strong>${escapeHtml(block.startTime)}-${escapeHtml(block.endTime)}</strong>
      <span>${escapeHtml(label)}</span>
      ${dateRange ? `<small>${escapeHtml(dateRange)}</small>` : ""}
      <small>${escapeHtml(pitch ? `${getVenueName(pitch.venueId)} / ${pitch.name}` : "Deleted pitch")}</small>
      ${canWrite ? `
        <div class="friendly-booking-actions">
          <button class="secondary-btn" type="button" data-edit-pitch-block="${block.id}">Edit</button>
          <button class="delete-btn" type="button" data-delete-pitch-block="${block.id}">Delete</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderPlannerOutputs() {
  renderOptimisedHomePlan();
  renderVisualPlanner();
}

function toggleWinterTrainingCollapse() {
  plannerUiState.winterTrainingCollapsed = !plannerUiState.winterTrainingCollapsed;
  writeUiBoolean(WINTER_TRAINING_COLLAPSED_KEY, plannerUiState.winterTrainingCollapsed);
  syncWinterTrainingCollapse();
}

function syncWinterTrainingCollapse() {
  if (!winterTrainingSection || !winterTrainingContent || !winterCollapseBtn) return;
  const collapsed = Boolean(plannerUiState.winterTrainingCollapsed);
  winterTrainingContent.hidden = collapsed;
  winterTrainingSection.classList.toggle("is-collapsed", collapsed);
  winterCollapseBtn.textContent = collapsed ? "Show Winter" : "Hide Winter";
  winterCollapseBtn.setAttribute("aria-expanded", String(!collapsed));
}

function renderWinterTrainingPlanner() {
  renderWinterTeamOptions();
  winterTrainingBoard.innerHTML = "";

  appendWinterTrainingSummary();
  for (const time of WINTER_TRAINING_TIMES) {
    appendWinterTrainingBoard(time);
  }

  bindRowActions(winterTrainingBoard, "edit-winter", startEditWinterAssignment);
  bindRowActions(winterTrainingBoard, "delete-winter", deleteWinterAssignment);
  renderWinterTrainingVisual();
  syncEditorButtons();
}

function renderWinterTrainingVisual() {
  winterTrainingVisual.innerHTML = "";
  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>Winter Visual Planner</h3>
      <p>${escapeHtml("Brownedge week view across Monday to Friday at 18:00, 19:00, and 20:00.")}</p>
    </div>
    <div class="schedule-board__body">
      ${renderTrainingVisualTable((day, time) =>
        renderTrainingVisualCell(getWinterAssignmentsForSlot(day, time), getWinterSlotAreasUsed(day, time), 3)
      )}
    </div>`;
  winterTrainingVisual.appendChild(board);
}

function appendWinterTrainingSummary() {
  const assignedIds = new Set(state.winterTrainingAssignments.map((assignment) => assignment.teamId));
  const unassignedTeams = sortTeams(state.teams).filter((team) => !assignedIds.has(team.id));
  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>Winter Overview</h3>
      <p>${escapeHtml(`${state.winterTrainingAssignments.length} of ${state.teams.length} teams assigned`)}</p>
    </div>
    <div class="schedule-board__body">
      <section class="venue-panel">
        <h4>Winter Venue</h4>
        <p class="venue-panel__meta">Winter training runs at Brownedge with 3 training areas per hour across Monday to Friday at 18:00, 19:00, and 20:00.</p>
        <div class="schedule-list">
          <article class="schedule-item">
            <div class="schedule-item__time">Brownedge</div>
            <div class="schedule-item__meta">3 areas per hour across the standard winter timetable.</div>
          </article>
        </div>
      </section>
      <section class="venue-panel">
        <h4>Unassigned Teams</h4>
        <p class="venue-panel__meta">Teams use the same training area requirement and preferred time as summer.</p>
        <div class="schedule-list">
          ${unassignedTeams.length
            ? unassignedTeams.map((team) => `
              <article class="schedule-item warning-item">
                <div class="schedule-item__time">${escapeHtml(formatTeamDisplayName(team))} (${escapeHtml(team.format)})</div>
                <div class="schedule-item__meta">${escapeHtml(`${formatTrainingAreaLabel(team.winterTrainingAreas)} · prefers ${team.winterTrainingPreference}`)}</div>
              </article>`).join("")
            : '<article class="schedule-item"><div class="schedule-item__time">All teams assigned</div><div class="schedule-item__meta">Winter training slots are currently filled.</div></article>'}
        </div>
      </section>
    </div>`;
  winterTrainingBoard.appendChild(board);
}

function appendWinterTrainingBoard(time) {
  const totalAreasUsed = WINTER_TRAINING_DAYS.reduce((total, day) => total + getWinterSlotAreasUsed(day, time), 0);
  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>${escapeHtml(`Winter ${time}`)}</h3>
      <p>${escapeHtml(`${totalAreasUsed} of ${WINTER_TRAINING_DAYS.length * 3} areas used across the week`)}</p>
    </div>
    <div class="schedule-board__body training-slot-grid">
      ${WINTER_TRAINING_DAYS.map((day) => renderWinterTrainingCell(day, time)).join("")}
    </div>`;
  winterTrainingBoard.appendChild(board);
}

function renderWinterTrainingCell(day, time) {
  const assignments = getWinterAssignmentsForSlot(day, time);
  const assignmentGroups = groupTrainingAssignments(assignments);
  const areasUsed = getTrainingGroupsAreaUsage(assignmentGroups);
  const canWrite = canCurrentUserEditTraining();
  return `
    <section class="venue-panel training-slot-panel">
      <h4>${escapeHtml(day)}</h4>
      <p class="venue-panel__meta">${escapeHtml(`${areasUsed} of 3 areas used at ${time}`)}</p>
      <div class="schedule-list">
        ${assignmentGroups.length
          ? assignmentGroups.map((group) => renderTrainingGroupScheduleItem(group, "winter", canWrite)).join("")
          : '<p class="empty-state">No teams allocated.</p>'}
      </div>
    </section>`;
}

function renderWinterTeamOptions(selectedTeamId = editState.winterTeamId || "") {
  winterTeamSelect.innerHTML = "";
  if (!state.teams.length) {
    winterTeamSelect.innerHTML = `<option value="">Add a team first</option>`;
    winterTeamSelect.disabled = true;
    return;
  }
  const availableTeams = getAvailableTrainingTeams(state.winterTrainingAssignments, selectedTeamId);
  if (!availableTeams.length) {
    winterTeamSelect.innerHTML = `<option value="">All teams already assigned</option>`;
    winterTeamSelect.disabled = true;
    return;
  }
  winterTeamSelect.disabled = !canCurrentUserEditTraining();
  for (const team of availableTeams) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = `${formatTeamDisplayName(team)} (${formatTrainingAreaLabel(team.winterTrainingAreas)} / prefers ${team.winterTrainingPreference})`;
    winterTeamSelect.appendChild(option);
  }
  if (state.teams.some((team) => team.id === selectedTeamId)) {
    winterTeamSelect.value = selectedTeamId;
  }
  renderWinterSharedWithOptions();
}

function getWinterAssignmentsForSlot(day, time) {
  return state.winterTrainingAssignments
    .filter((assignment) => assignment.day === day && assignment.time === time)
    .map((assignment) => ({
      ...assignment,
      team: state.teams.find((team) => team.id === assignment.teamId),
    }))
    .filter((assignment) => assignment.team)
    .sort((a, b) =>
      compareTeamAgeGroup(a.team.ageGroup, b.team.ageGroup) ||
      a.team.name.localeCompare(b.team.name)
    );
}

function getWinterSlotAreasUsed(day, time, ignoreTeamId = null) {
  const assignments = state.winterTrainingAssignments
    .filter((assignment) => assignment.day === day && assignment.time === time && assignment.teamId !== ignoreTeamId)
    .map((assignment) => ({
      ...assignment,
      team: state.teams.find((team) => team.id === assignment.teamId),
    }))
    .filter((assignment) => assignment.team);
  return getTrainingGroupsAreaUsage(groupTrainingAssignments(assignments));
}

function getWinterAssignmentPreview(day, time, ignoreTeamId = null, previewAssignment = null) {
  const assignments = state.winterTrainingAssignments
    .filter((assignment) => assignment.day === day && assignment.time === time && assignment.teamId !== ignoreTeamId)
    .concat(previewAssignment ? [previewAssignment] : [])
    .map((assignment) => ({
      ...assignment,
      team: state.teams.find((team) => team.id === assignment.teamId),
    }))
    .filter((assignment) => assignment.team);
  return assignments;
}

function renderWinterSharedWithOptions(selectedTeamId = winterSharedWithSelect.value) {
  const teamId = winterTeamSelect.value;
  const day = winterDaySelect.value;
  const time = winterTimeSelect.value;
  const shareOptions = getWinterAssignmentsForSlot(day, time).filter((assignment) => assignment.teamId !== teamId);
  renderSharedWithOptions(winterSharedWithSelect, shareOptions, selectedTeamId);
}

function onSaveWinterAssignment(event) {
  event.preventDefault();
  if (!requireTrainingWriteAccess()) return;
  const formData = new FormData(winterAssignmentForm);
  const teamId = String(formData.get("teamId") || "");
  const day = String(formData.get("day") || "");
  const time = String(formData.get("time") || "");
  const sharedWithTeamId = String(formData.get("sharedWithTeamId") || "");
  const issue = validateWinterAssignment(teamId, day, time, editState.winterTeamId || null, sharedWithTeamId);
  if (issue) return setTrainingMessage(issue, "error");

  const existingIndex = state.winterTrainingAssignments.findIndex((assignment) => assignment.teamId === teamId);
  const assignment = { teamId, day, time, sharedWithTeamId };
  if (existingIndex !== -1) {
    state.winterTrainingAssignments[existingIndex] = assignment;
  } else {
    state.winterTrainingAssignments.push(assignment);
  }

  saveState();
  renderWinterTrainingPlanner();
  resetWinterAssignmentForm();
  setTrainingMessage("Winter training assignment saved.", "ok");
}

function validateWinterAssignment(teamId, day, time, ignoreTeamId = null, sharedWithTeamId = "") {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return "Choose a valid team for winter training.";
  if (!WINTER_TRAINING_DAYS.includes(day)) return "Choose a valid weekday for winter training.";
  if (!WINTER_TRAINING_TIMES.includes(time)) return "Choose a valid winter training time.";
  if (sharedWithTeamId && sharedWithTeamId === teamId) return "A team cannot share a training area with itself.";
  const slotAssignments = getWinterAssignmentPreview(day, time, ignoreTeamId || teamId, { teamId, day, time, sharedWithTeamId });
  if (sharedWithTeamId && !slotAssignments.some((assignment) => assignment.teamId === sharedWithTeamId)) {
    return "Choose a team already in that winter slot to share an area with.";
  }
  const usedAreas = getTrainingGroupsAreaUsage(groupTrainingAssignments(slotAssignments));
  if (usedAreas > 3) {
    const currentAreas = getWinterSlotAreasUsed(day, time, ignoreTeamId || teamId);
    return `That winter slot only has ${Math.max(0, 3 - currentAreas)} area${3 - currentAreas === 1 ? "" : "s"} left.`;
  }
  return null;
}

function startEditWinterAssignment(teamId) {
  if (!requireTrainingWriteAccess()) return;
  const assignment = state.winterTrainingAssignments.find((item) => item.teamId === teamId);
  if (!assignment) return setTrainingMessage("That winter assignment could not be found.", "error");
  setActiveTab("training");
  editState.winterTeamId = teamId;
  renderWinterTeamOptions(assignment.teamId);
  winterTeamSelect.value = assignment.teamId;
  winterDaySelect.value = assignment.day;
  winterTimeSelect.value = assignment.time;
  renderWinterSharedWithOptions(assignment.sharedWithTeamId);
  syncEditorButtons();
}

function deleteWinterAssignment(teamId) {
  if (!requireTrainingWriteAccess()) return;
  state.winterTrainingAssignments = state.winterTrainingAssignments.filter((assignment) => assignment.teamId !== teamId);
  if (editState.winterTeamId === teamId) resetWinterAssignmentForm();
  saveState();
  renderWinterTrainingPlanner();
  setTrainingMessage("Winter training assignment removed.", "ok");
}

function resetWinterAssignmentForm() {
  editState.winterTeamId = null;
  winterAssignmentForm.reset();
  renderWinterTeamOptions();
  renderWinterSharedWithOptions();
  if (WINTER_TRAINING_DAYS.includes("Monday")) winterDaySelect.value = "Monday";
  if (WINTER_TRAINING_TIMES.includes("18:00")) winterTimeSelect.value = "18:00";
  renderWinterSharedWithOptions();
  syncEditorButtons();
}

function autoFillWinterAssignments() {
  if (!requireTrainingWriteAccess()) return;
  const assignedIds = new Set(state.winterTrainingAssignments.map((assignment) => assignment.teamId));
  const teamsToAssign = sortTeams(state.teams)
    .filter((team) => !assignedIds.has(team.id))
    .sort((a, b) =>
      b.winterTrainingAreas - a.winterTrainingAreas ||
      a.winterTrainingPreference.localeCompare(b.winterTrainingPreference) ||
      compareTeamAgeGroup(a.ageGroup, b.ageGroup)
    );

  let assignedCount = 0;
  for (const team of teamsToAssign) {
    const candidateSlots = buildWinterCandidateSlots(team);
    const chosen = candidateSlots.find((slot) => !validateWinterAssignment(team.id, slot.day, slot.time, team.id));
    if (!chosen) continue;
    state.winterTrainingAssignments.push({ teamId: team.id, day: chosen.day, time: chosen.time });
    assignedCount += 1;
  }

  saveState();
  renderWinterTrainingPlanner();
  setTrainingMessage(
    assignedCount
      ? `Auto-filled ${assignedCount} winter training assignment${assignedCount === 1 ? "" : "s"}.`
      : "No additional winter assignments could be placed.",
    assignedCount ? "ok" : "error"
  );
}

function buildWinterCandidateSlots(team) {
  return WINTER_TRAINING_TIMES
    .flatMap((time) =>
      WINTER_TRAINING_DAYS.map((day) => ({ day, time }))
    )
    .sort((a, b) =>
      Number(a.time !== team.winterTrainingPreference) - Number(b.time !== team.winterTrainingPreference) ||
      getWinterSlotAreasUsed(a.day, a.time) - getWinterSlotAreasUsed(b.day, b.time) ||
      dayIndex(a.day) - dayIndex(b.day)
    );
}

function clearWinterAssignments() {
  if (!requireTrainingWriteAccess()) return;
  if (!confirm("Clear the entire winter training plan? This cannot be undone unless you have a data export.")) return;
  state.winterTrainingAssignments = [];
  resetWinterAssignmentForm();
  saveState();
  renderWinterTrainingPlanner();
  setTrainingMessage("Winter training plan cleared.", "ok");
}

function renderSummerTeamOptions(selectedTeamId = editState.summerTeamId || "") {
  summerTeamSelect.innerHTML = "";
  if (!state.teams.length) {
    summerTeamSelect.innerHTML = `<option value="">Add a team first</option>`;
    summerTeamSelect.disabled = true;
    return;
  }
  const availableTeams = getAvailableTrainingTeams(state.summerTrainingAssignments, selectedTeamId);
  if (!availableTeams.length) {
    summerTeamSelect.innerHTML = `<option value="">All teams already assigned</option>`;
    summerTeamSelect.disabled = true;
    return;
  }
  summerTeamSelect.disabled = !canCurrentUserEditTraining();
  for (const team of availableTeams) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = `${formatTeamDisplayName(team)} (${formatTrainingAreaLabel(team.winterTrainingAreas)} / prefers ${team.winterTrainingPreference})`;
    summerTeamSelect.appendChild(option);
  }
  if (state.teams.some((team) => team.id === selectedTeamId)) summerTeamSelect.value = selectedTeamId;
  renderSummerSharedWithOptions();
}

function renderSummerVenueOptions(selectedVenueId = summerVenueSelect.value) {
  summerVenueSelect.innerHTML = "";
  const enabledVenues = getSummerEnabledVenues();
  if (!enabledVenues.length) {
    summerVenueSelect.innerHTML = `<option value="">Set summer areas on a venue first</option>`;
    summerVenueSelect.disabled = true;
    return;
  }
  summerVenueSelect.disabled = !canCurrentUserEditTraining();
  for (const venue of enabledVenues) {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = `${venue.name} (${formatTrainingAreaLabel(venue.summerTrainingAreas)})`;
    summerVenueSelect.appendChild(option);
  }
  if (enabledVenues.some((venue) => venue.id === selectedVenueId)) summerVenueSelect.value = selectedVenueId;
  renderSummerSharedWithOptions();
}

function renderSummerTrainingPlanner() {
  renderSummerTeamOptions();
  renderSummerVenueOptions();
  summerTrainingBoard.innerHTML = "";

  appendSummerTrainingSummary();
  for (const venue of getSummerEnabledVenues()) {
    appendSummerTrainingBoard(venue);
  }

  bindRowActions(summerTrainingBoard, "edit-summer", startEditSummerTraining);
  bindRowActions(summerTrainingBoard, "delete-summer", deleteSummerTraining);
  renderSummerTrainingVisual();
  syncEditorButtons();
}

function renderUsers() {
  usersBody.innerHTML = "";
  if (!authState.enabled || !isCurrentUserAdmin()) {
    return;
  }

  for (const profile of [...authState.users].sort((a, b) => a.email.localeCompare(b.email))) {
    const permissions = getEffectivePermissions(profile);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(profile.displayName || "Unnamed user")}</td>
      <td>${escapeHtml(profile.email)}</td>
      <td>${escapeHtml(profile.role === "admin" ? "Admin" : "Viewer")}</td>
      <td>${escapeHtml(permissions.canWrite ? "Write" : "Read only")}</td>
      <td>${escapeHtml(permissions.visibleTabs.map(getTabLabel).join(", ") || "No tabs")}</td>
      <td class="row-actions">
        <button class="secondary-btn" type="button" data-edit-user="${profile.userId}">Edit</button>
      </td>`;
    usersBody.appendChild(row);
  }

  bindRowActions(usersBody, "edit-user", startEditUser);
}

function startEditUser(userId) {
  const profile = authState.users.find((item) => item.userId === userId);
  if (!profile) {
    setUsersMessage("That user could not be found.", "error");
    return;
  }

  setActiveTab("users");
  editState.userId = userId;
  userDisplayNameInput.value = profile.displayName;
  userEmailInput.value = profile.email;
  userRoleSelect.value = profile.role;
  userPasswordInput.value = "";
  userCanWriteOverrideEnabledInput.checked = typeof profile.canWriteOverride === "boolean";
  userCanWriteOverrideInput.checked =
    typeof profile.canWriteOverride === "boolean"
      ? profile.canWriteOverride
      : getRoleDefaults(profile.role).canWrite;
  renderUserTabOverrideInputs(profile.tabOverrides);
  syncUserOverrideControls();
  syncEditorButtons();
}

function appendSummerTrainingSummary() {
  const enabledVenues = getSummerEnabledVenues();
  const assignedIds = new Set(state.summerTrainingAssignments.map((assignment) => assignment.teamId));
  const unassignedTeams = sortTeams(state.teams).filter((team) => !assignedIds.has(team.id));
  const calendarStartDate = state.settings.summerTrainingStartDate;
  const calendarWindow = formatSummerTrainingCalendarWindow();
  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>Summer Overview</h3>
      <p>${escapeHtml(`${state.summerTrainingAssignments.length} of ${state.teams.length} teams assigned`)}</p>
    </div>
    <div class="schedule-board__body">
      <section class="venue-panel">
        <h4>Summer Venues</h4>
        <p class="venue-panel__meta">${escapeHtml(calendarStartDate
          ? `Friendly calendar blocks run ${calendarWindow}. Two training areas reserve one physical pitch.`
          : "Set a summer training start date above to block these sessions on the friendly calendar.")}</p>
        <div class="schedule-list">
          ${enabledVenues.length
            ? enabledVenues.map((venue) => `
              <article class="schedule-item">
                <div class="schedule-item__time">${escapeHtml(venue.name)}</div>
                <div class="schedule-item__meta">${escapeHtml(`${formatTrainingAreaLabel(venue.summerTrainingAreas)} per hour across Monday to Friday at 18:00, 19:00, and 20:00`)}</div>
              </article>`).join("")
            : '<article class="schedule-item warning-item"><div class="schedule-item__time">No summer venues configured</div><div class="schedule-item__meta">Set Summer Areas on venues such as Gregson Green and Frank Thompson in the Venues tab to start planning.</div></article>'}
        </div>
      </section>
      <section class="venue-panel">
        <h4>Unassigned Teams</h4>
        <p class="venue-panel__meta">Teams use the same training area requirement and preferred time as winter.</p>
        <div class="schedule-list">
          ${unassignedTeams.length
            ? unassignedTeams.map((team) => `
              <article class="schedule-item warning-item">
                <div class="schedule-item__time">${escapeHtml(formatTeamDisplayName(team))} (${escapeHtml(team.format)})</div>
                <div class="schedule-item__meta">${escapeHtml(`${formatTrainingAreaLabel(team.winterTrainingAreas)} · prefers ${team.winterTrainingPreference}`)}</div>
              </article>`).join("")
            : '<article class="schedule-item"><div class="schedule-item__time">All teams assigned</div><div class="schedule-item__meta">Summer training slots are currently filled.</div></article>'}
        </div>
      </section>
    </div>`;
  summerTrainingBoard.appendChild(board);
}

function appendSummerTrainingBoard(venue) {
  const totalCapacity = WINTER_TRAINING_DAYS.length * WINTER_TRAINING_TIMES.length * venue.summerTrainingAreas;
  const totalAreasUsed = WINTER_TRAINING_DAYS.reduce(
    (total, day) =>
      total +
      WINTER_TRAINING_TIMES.reduce(
        (dayTotal, time) => dayTotal + getSummerSlotAreasUsed(venue.id, day, time),
        0
      ),
    0
  );
  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>${escapeHtml(`Summer ${venue.name}`)}</h3>
      <p>${escapeHtml(`${totalAreasUsed} of ${totalCapacity} areas used across the week`)}</p>
    </div>
    <div class="schedule-board__body training-slot-grid">
      ${WINTER_TRAINING_DAYS.flatMap((day) =>
        WINTER_TRAINING_TIMES.map((time) => renderSummerTrainingCell(venue, day, time))
      ).join("")}
    </div>`;
  summerTrainingBoard.appendChild(board);
}

function renderSummerTrainingCell(venue, day, time) {
  const assignments = getSummerAssignmentsForSlot(venue.id, day, time);
  const assignmentGroups = groupTrainingAssignments(assignments);
  const areasUsed = getTrainingGroupsAreaUsage(assignmentGroups);
  const canWrite = canCurrentUserEditTraining();
  return `
    <section class="venue-panel training-slot-panel">
      <h4>${escapeHtml(day)}</h4>
      <p class="venue-panel__meta">${escapeHtml(`${time} · ${areasUsed} of ${venue.summerTrainingAreas} areas used`)}</p>
      <div class="schedule-list">
        ${assignmentGroups.length
          ? assignmentGroups.map((group) => renderTrainingGroupScheduleItem(group, "summer", canWrite)).join("")
          : '<p class="empty-state">No teams allocated.</p>'}
      </div>
    </section>`;
}

function renderSummerTrainingVisual() {
  summerTrainingVisual.innerHTML = "";
  const enabledVenues = getSummerEnabledVenues();
  if (!enabledVenues.length) {
    const board = document.createElement("section");
    board.className = "schedule-board";
    board.innerHTML = `
      <div class="schedule-board__header">
        <h3>Summer Visual Planner</h3>
        <p>${escapeHtml("Configure summer areas on a venue to generate the week view.")}</p>
      </div>
      <div class="schedule-board__body">
        <p class="empty-state">Gregson Green and Frank Thompson can be enabled by setting their Summer Areas in the Venues tab.</p>
      </div>`;
    summerTrainingVisual.appendChild(board);
    return;
  }

  for (const venue of enabledVenues) {
    const board = document.createElement("section");
    board.className = "schedule-board";
    board.innerHTML = `
      <div class="schedule-board__header">
        <h3>${escapeHtml(`Summer Visual Planner · ${venue.name}`)}</h3>
        <p>${escapeHtml(`${formatTrainingAreaLabel(venue.summerTrainingAreas)} available each hour`)}</p>
      </div>
      <div class="schedule-board__body">
        ${renderTrainingVisualTable((day, time) =>
          renderTrainingVisualCell(
            getSummerAssignmentsForSlot(venue.id, day, time),
            getSummerSlotAreasUsed(venue.id, day, time),
            venue.summerTrainingAreas
          )
        )}
      </div>`;
    summerTrainingVisual.appendChild(board);
  }
}

function onSaveSummerTraining(event) {
  event.preventDefault();
  if (!requireTrainingWriteAccess()) return;
  const formData = new FormData(summerTrainingForm);
  const teamId = String(formData.get("teamId") || "");
  const venueId = String(formData.get("venueId") || "");
  const day = String(formData.get("day") || "");
  const time = String(formData.get("time") || "");
  const sharedWithTeamId = String(formData.get("sharedWithTeamId") || "");
  const issue = validateSummerTrainingAssignment(teamId, venueId, day, time, editState.summerTeamId || null, sharedWithTeamId);
  if (issue) return setTrainingMessage(issue, "error");

  const assignment = { teamId, venueId, day, time, sharedWithTeamId };
  const existingIndex = state.summerTrainingAssignments.findIndex((item) => item.teamId === teamId);
  if (existingIndex !== -1) {
    state.summerTrainingAssignments[existingIndex] = assignment;
  } else {
    state.summerTrainingAssignments.push(assignment);
  }

  saveState();
  renderSummerTrainingPlanner();
  renderFriendlyBookingPlanner();
  resetSummerTrainingForm();
  setTrainingMessage("Summer training assignment saved.", "ok");
}

function validateSummerTrainingAssignment(teamId, venueId, day, time, ignoreTeamId = null, sharedWithTeamId = "") {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return "Choose a valid team for summer training.";
  const venue = state.venues.find((item) => item.id === venueId);
  if (!venue || venue.summerTrainingAreas < 1) return "Choose a summer-enabled venue.";
  if (!WINTER_TRAINING_DAYS.includes(day)) return "Choose a valid weekday for summer training.";
  if (!WINTER_TRAINING_TIMES.includes(time)) return "Choose a valid summer training time.";
  if (sharedWithTeamId && sharedWithTeamId === teamId) return "A team cannot share a training area with itself.";
  const slotAssignments = getSummerAssignmentPreview(venueId, day, time, ignoreTeamId || teamId, { teamId, venueId, day, time, sharedWithTeamId });
  if (sharedWithTeamId && !slotAssignments.some((assignment) => assignment.teamId === sharedWithTeamId)) {
    return "Choose a team already in that summer slot to share an area with.";
  }
  const usedAreas = getTrainingGroupsAreaUsage(groupTrainingAssignments(slotAssignments));
  if (usedAreas > venue.summerTrainingAreas) {
    const currentAreas = getSummerSlotAreasUsed(venueId, day, time, ignoreTeamId || teamId);
    return `That summer slot only has ${Math.max(0, venue.summerTrainingAreas - currentAreas)} area${venue.summerTrainingAreas - currentAreas === 1 ? "" : "s"} left.`;
  }
  return null;
}

function validateSummerVenueCapacity(venueId, areaCapacity) {
  if (areaCapacity < 0) return "Summer areas cannot be negative.";
  for (const day of WINTER_TRAINING_DAYS) {
    for (const time of WINTER_TRAINING_TIMES) {
      const usedAreas = getSummerSlotAreasUsed(venueId, day, time);
      if (usedAreas > areaCapacity) {
        const venueName = state.venues.find((item) => item.id === venueId)?.name || "This venue";
        return `${venueName} already uses ${usedAreas} area${usedAreas === 1 ? "" : "s"} on ${day} at ${time}. Increase Summer Areas or move teams first.`;
      }
    }
  }
  return null;
}

function getSummerEnabledVenues() {
  return [...state.venues]
    .filter((venue) => venue.summerTrainingAreas > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSummerAssignmentsForSlot(venueId, day, time) {
  return state.summerTrainingAssignments
    .filter((assignment) => assignment.venueId === venueId && assignment.day === day && assignment.time === time)
    .map((assignment) => ({
      ...assignment,
      team: state.teams.find((team) => team.id === assignment.teamId),
    }))
    .filter((assignment) => assignment.team)
    .sort((a, b) =>
      compareTeamAgeGroup(a.team.ageGroup, b.team.ageGroup) ||
      a.team.name.localeCompare(b.team.name)
    );
}

function getSummerSlotAreasUsed(venueId, day, time, ignoreTeamId = null) {
  const assignments = state.summerTrainingAssignments
    .filter(
      (assignment) =>
        assignment.venueId === venueId &&
        assignment.day === day &&
        assignment.time === time &&
        assignment.teamId !== ignoreTeamId
    )
    .map((assignment) => ({
      ...assignment,
      team: state.teams.find((team) => team.id === assignment.teamId),
    }))
    .filter((assignment) => assignment.team);
  return getTrainingGroupsAreaUsage(groupTrainingAssignments(assignments));
}

function getSummerAssignmentPreview(venueId, day, time, ignoreTeamId = null, previewAssignment = null) {
  return state.summerTrainingAssignments
    .filter(
      (assignment) =>
        assignment.venueId === venueId &&
        assignment.day === day &&
        assignment.time === time &&
        assignment.teamId !== ignoreTeamId
    )
    .concat(previewAssignment ? [previewAssignment] : [])
    .map((assignment) => ({
      ...assignment,
      team: state.teams.find((team) => team.id === assignment.teamId),
    }))
    .filter((assignment) => assignment.team);
}

function renderSummerSharedWithOptions(selectedTeamId = summerSharedWithSelect.value) {
  const teamId = summerTeamSelect.value;
  const venueId = summerVenueSelect.value;
  const day = summerDaySelect.value;
  const time = summerTimeSelect.value;
  const shareOptions = getSummerAssignmentsForSlot(venueId, day, time).filter((assignment) => assignment.teamId !== teamId);
  renderSharedWithOptions(summerSharedWithSelect, shareOptions, selectedTeamId);
}

function startEditSummerTraining(teamId) {
  if (!requireTrainingWriteAccess()) return;
  const assignment = state.summerTrainingAssignments.find((item) => item.teamId === teamId);
  if (!assignment) return setTrainingMessage("That summer assignment could not be found.", "error");
  setActiveTab("training");
  editState.summerTeamId = teamId;
  renderSummerTeamOptions(assignment.teamId);
  renderSummerVenueOptions(assignment.venueId);
  summerDaySelect.value = assignment.day;
  summerTimeSelect.value = assignment.time;
  renderSummerSharedWithOptions(assignment.sharedWithTeamId);
  syncEditorButtons();
}

function deleteSummerTraining(teamId) {
  if (!requireTrainingWriteAccess()) return;
  state.summerTrainingAssignments = state.summerTrainingAssignments.filter((assignment) => assignment.teamId !== teamId);
  if (editState.summerTeamId === teamId) resetSummerTrainingForm();
  saveState();
  renderSummerTrainingPlanner();
  renderFriendlyBookingPlanner();
  setTrainingMessage("Summer training assignment removed.", "ok");
}

function resetSummerTrainingForm() {
  editState.summerTeamId = null;
  summerTrainingForm.reset();
  renderSummerTeamOptions();
  renderSummerVenueOptions();
  if (WINTER_TRAINING_DAYS.includes("Monday")) summerDaySelect.value = "Monday";
  if (WINTER_TRAINING_TIMES.includes("18:00")) summerTimeSelect.value = "18:00";
  renderSummerSharedWithOptions();
  syncEditorButtons();
}

function autoFillSummerAssignments() {
  if (!requireTrainingWriteAccess()) return;
  const enabledVenues = getSummerEnabledVenues();
  if (!enabledVenues.length) return setTrainingMessage("Configure at least one summer-enabled venue first.", "error");

  const assignedIds = new Set(state.summerTrainingAssignments.map((assignment) => assignment.teamId));
  const teamsToAssign = sortTeams(state.teams)
    .filter((team) => !assignedIds.has(team.id))
    .sort((a, b) =>
      b.winterTrainingAreas - a.winterTrainingAreas ||
      a.winterTrainingPreference.localeCompare(b.winterTrainingPreference) ||
      compareTeamAgeGroup(a.ageGroup, b.ageGroup)
    );

  let assignedCount = 0;
  for (const team of teamsToAssign) {
    const candidateSlots = buildSummerCandidateSlots(team);
    const chosen = candidateSlots.find((slot) => !validateSummerTrainingAssignment(team.id, slot.venueId, slot.day, slot.time, team.id));
    if (!chosen) continue;
    state.summerTrainingAssignments.push({
      teamId: team.id,
      venueId: chosen.venueId,
      day: chosen.day,
      time: chosen.time,
    });
    assignedCount += 1;
  }

  saveState();
  renderSummerTrainingPlanner();
  renderFriendlyBookingPlanner();
  setTrainingMessage(
    assignedCount
      ? `Auto-filled ${assignedCount} summer training assignment${assignedCount === 1 ? "" : "s"}.`
      : "No additional summer assignments could be placed.",
    assignedCount ? "ok" : "error"
  );
}

function buildSummerCandidateSlots(team) {
  return getSummerEnabledVenues()
    .flatMap((venue) =>
      WINTER_TRAINING_TIMES.flatMap((time) =>
        WINTER_TRAINING_DAYS.map((day) => ({ venueId: venue.id, day, time }))
      )
    )
    .sort((a, b) =>
      Number(a.time !== team.winterTrainingPreference) - Number(b.time !== team.winterTrainingPreference) ||
      getSummerSlotLoadRatio(a.venueId, a.day, a.time) - getSummerSlotLoadRatio(b.venueId, b.day, b.time) ||
      dayIndex(a.day) - dayIndex(b.day) ||
      getVenueName(a.venueId).localeCompare(getVenueName(b.venueId))
    );
}

function clearSummerAssignments() {
  if (!requireTrainingWriteAccess()) return;
  if (!confirm("Clear the entire summer training plan? This cannot be undone unless you have a data export.")) return;
  state.summerTrainingAssignments = [];
  resetSummerTrainingForm();
  saveState();
  renderSummerTrainingPlanner();
  renderFriendlyBookingPlanner();
  setTrainingMessage("Summer training plan cleared.", "ok");
}

function renderTrainingVisualTable(cellRenderer) {
  return `
    <div class="table-wrap">
      <table class="training-visual-table">
        <thead>
          <tr>
            <th>Time</th>
            ${WINTER_TRAINING_DAYS.map((day) => `<th>${escapeHtml(day)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${WINTER_TRAINING_TIMES.map((time) => `
            <tr>
              <th>${escapeHtml(time)}</th>
              ${WINTER_TRAINING_DAYS.map((day) => `<td>${cellRenderer(day, time)}</td>`).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderTrainingVisualCell(assignments, areasUsed, capacity) {
  const assignmentGroups = groupTrainingAssignments(assignments);
  return `
    <div class="training-visual-cell">
      <div class="training-visual-capacity">${escapeHtml(`${areasUsed} of ${capacity} areas used`)}</div>
      ${assignmentGroups.length
        ? assignmentGroups.map((group) => `
          <div class="training-visual-team${group.isShared ? " is-shared" : ""}">
            <strong>${escapeHtml(formatTrainingGroupTitle(group))}</strong>
            <small>${escapeHtml(formatTrainingGroupAreaLabel(group))}</small>
          </div>`).join("")
        : '<span class="empty-state">No teams allocated.</span>'}
    </div>`;
}

function groupTrainingAssignments(assignments) {
  const validAssignments = assignments.filter((assignment) => assignment?.team);
  const assignmentByTeamId = new Map(validAssignments.map((assignment) => [assignment.teamId, assignment]));
  const links = new Map(validAssignments.map((assignment) => [assignment.teamId, new Set()]));

  for (const assignment of validAssignments) {
    const sharedWithTeamId = String(assignment.sharedWithTeamId || "");
    if (!sharedWithTeamId || sharedWithTeamId === assignment.teamId || !assignmentByTeamId.has(sharedWithTeamId)) continue;
    links.get(assignment.teamId).add(sharedWithTeamId);
    links.get(sharedWithTeamId).add(assignment.teamId);
  }

  const visited = new Set();
  const groups = [];
  for (const assignment of validAssignments) {
    if (visited.has(assignment.teamId)) continue;
    const stack = [assignment.teamId];
    const teamIds = [];
    visited.add(assignment.teamId);

    while (stack.length) {
      const teamId = stack.pop();
      teamIds.push(teamId);
      for (const linkedTeamId of links.get(teamId) || []) {
        if (visited.has(linkedTeamId)) continue;
        visited.add(linkedTeamId);
        stack.push(linkedTeamId);
      }
    }

    const groupAssignments = teamIds
      .map((teamId) => assignmentByTeamId.get(teamId))
      .filter(Boolean)
      .sort((a, b) => compareTeamAgeGroup(a.team.ageGroup, b.team.ageGroup) || a.team.name.localeCompare(b.team.name));
    const areaUsed = groupAssignments.length > 1
      ? Math.max(...groupAssignments.map((item) => item.team.winterTrainingAreas || 1))
      : groupAssignments.reduce((total, item) => total + (item.team.winterTrainingAreas || 0), 0);
    groups.push({
      assignments: groupAssignments,
      areaUsed,
      isShared: groupAssignments.length > 1,
    });
  }

  return groups.sort((a, b) =>
    compareTeamAgeGroup(a.assignments[0]?.team.ageGroup, b.assignments[0]?.team.ageGroup) ||
    formatTrainingGroupTitle(a).localeCompare(formatTrainingGroupTitle(b))
  );
}

function getTrainingGroupsAreaUsage(groups) {
  return groups.reduce((total, group) => total + group.areaUsed, 0);
}

function formatTrainingGroupTitle(group) {
  return group.assignments.map((assignment) => formatTeamDisplayName(assignment.team)).join(" + ");
}

function formatTrainingGroupAreaLabel(group) {
  if (group.isShared) {
    return `${formatTrainingAreaLabel(group.areaUsed)} shared`;
  }
  return formatTrainingAreaLabel(group.areaUsed);
}

function formatTrainingGroupFormats(group) {
  return [...new Set(group.assignments.map((assignment) => assignment.team.format).filter(Boolean))].join(", ");
}

function renderTrainingGroupScheduleItem(group, planType, canWrite) {
  const actionName = planType === "summer" ? "summer" : "winter";
  return `
    <article class="schedule-item${group.isShared ? " shared-training-item" : ""}">
      <div class="schedule-item__time">${escapeHtml(formatTrainingGroupTitle(group))}</div>
      <div class="schedule-item__meta">${escapeHtml(formatTrainingGroupAreaLabel(group))}</div>
      ${canWrite ? `
        <div class="schedule-item__actions">
          ${group.assignments.map((assignment) => `
            <button class="secondary-btn" type="button" data-edit-${actionName}="${assignment.team.id}">Edit ${escapeHtml(formatTeamDisplayName(assignment.team))}</button>
            <button class="delete-btn" type="button" data-delete-${actionName}="${assignment.team.id}">Remove</button>
          `).join("")}
        </div>
      ` : ""}
    </article>`;
}

function renderSharedWithOptions(select, assignments, selectedTeamId = "") {
  select.innerHTML = '<option value="">No shared area</option>';
  for (const assignment of assignments) {
    const option = document.createElement("option");
    option.value = assignment.teamId;
    option.textContent = formatTeamDisplayName(assignment.team);
    select.appendChild(option);
  }
  if (assignments.some((assignment) => assignment.teamId === selectedTeamId)) {
    select.value = selectedTeamId;
  }
  select.disabled = assignments.length === 0 || !canCurrentUserEditTraining();
}

function openTrainingPlanPdf(planType) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    setTrainingMessage("Allow pop-ups for this site to generate the PDF.", "error");
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(buildTrainingPlanPdfDocument(planType));
  reportWindow.document.close();
  reportWindow.focus();
}

function buildTrainingPlanPdfDocument(planType) {
  const isWinter = planType === "winter";
  const title = isWinter ? "Winter Training Plan" : "Summer Training Plan";
  const assignedCount = isWinter ? state.winterTrainingAssignments.length : state.summerTrainingAssignments.length;
  const unassignedTeams = getUnassignedTrainingTeams(isWinter ? state.winterTrainingAssignments : state.summerTrainingAssignments);
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const logoUrl = new URL("assets/club-logo.png", window.location.href).href;
  const sections = isWinter ? getWinterTrainingPdfSections() : getSummerTrainingPdfSections();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --ink: #17212b;
      --muted: #54687a;
      --line: #cfd9d9;
      --soft: #f3f7f6;
      --brand: #123249;
      --accent: #0e7a67;
      --gold: #f3c13a;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background: #ffffff;
    }

    .pdf-page {
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px;
    }

    .pdf-header {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 18px;
      align-items: center;
      border-bottom: 5px solid var(--gold);
      padding-bottom: 18px;
      margin-bottom: 18px;
    }

    .pdf-logo {
      width: 88px;
      height: 88px;
      object-fit: contain;
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    h1 {
      color: var(--brand);
      font-size: 30px;
      line-height: 1.12;
    }

    .pdf-subtitle {
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 18px 0;
    }

    .summary-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--soft);
    }

    .summary-card strong {
      display: block;
      color: var(--brand);
      font-size: 20px;
      line-height: 1.2;
    }

    .summary-card span {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .plan-section {
      break-inside: avoid;
      margin-top: 20px;
    }

    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
      margin-bottom: 8px;
      color: var(--brand);
    }

    .section-title h2 {
      font-size: 20px;
    }

    .section-title p {
      color: var(--muted);
      font-size: 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1px solid var(--line);
    }

    th,
    td {
      border: 1px solid var(--line);
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }

    thead th {
      background: var(--brand);
      color: #ffffff;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    tbody th {
      width: 76px;
      background: #eef4f3;
      color: var(--brand);
      font-size: 14px;
      white-space: nowrap;
    }

    td {
      min-height: 96px;
      background: #ffffff;
    }

    .slot-meta {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .slot-meta.is-full {
      color: #8a5b00;
    }

    .team-list {
      display: grid;
      gap: 5px;
    }

    .team-card {
      border-left: 4px solid var(--accent);
      border-radius: 7px;
      background: #f7faf9;
      padding: 6px 7px;
      break-inside: avoid;
    }

    .team-card strong,
    .team-card span {
      display: block;
    }

    .team-card strong {
      font-size: 12px;
      line-height: 1.25;
    }

    .team-card span {
      margin-top: 2px;
      color: var(--muted);
      font-size: 11px;
    }

    .empty-slot {
      color: #7b8c98;
      font-size: 11px;
      font-style: italic;
    }

    .unassigned {
      margin-top: 20px;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      background: #fffaf0;
      break-inside: avoid;
    }

    .unassigned h2 {
      color: var(--brand);
      font-size: 18px;
      margin-bottom: 8px;
    }

    .unassigned-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      color: var(--ink);
      font-size: 12px;
    }

    .empty-report {
      border: 1px dashed var(--line);
      border-radius: 10px;
      padding: 18px;
      color: var(--muted);
      background: var(--soft);
    }

    .pdf-footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 11px;
    }

    @media print {
      @page {
        size: A4 landscape;
        margin: 10mm;
      }

      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .pdf-page {
        max-width: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main class="pdf-page">
    <header class="pdf-header">
      <img class="pdf-logo" src="${escapeHtml(logoUrl)}" alt="Gregson Lane JFC crest" />
      <div>
        <h1>Gregson Lane JFC ${escapeHtml(title)}</h1>
        <p class="pdf-subtitle">${escapeHtml(state.season.name || "Current season")} · Generated ${escapeHtml(generatedAt)}</p>
      </div>
    </header>

    <section class="summary-grid" aria-label="Plan summary">
      <div class="summary-card"><strong>${escapeHtml(String(assignedCount))}</strong><span>Teams Assigned</span></div>
      <div class="summary-card"><strong>${escapeHtml(String(state.teams.length))}</strong><span>Total Teams</span></div>
      <div class="summary-card"><strong>${escapeHtml(String(unassignedTeams.length))}</strong><span>Unassigned</span></div>
      <div class="summary-card"><strong>${escapeHtml(isWinter ? "Brownedge" : String(getSummerEnabledVenues().length))}</strong><span>${escapeHtml(isWinter ? "Venue" : "Venues")}</span></div>
    </section>

    ${sections.length ? sections.map(renderTrainingPdfSection).join("") : renderTrainingPdfEmptyState(planType)}
    ${renderTrainingPdfUnassigned(unassignedTeams)}

    <footer class="pdf-footer">
      Training slots are one hour long. Area usage reflects each team's training area requirement.
    </footer>
  </main>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 250);
    });
  </script>
</body>
</html>`;
}

function getWinterTrainingPdfSections() {
  return [{
    title: "Brownedge",
    subtitle: "3 training areas available each hour",
    getAssignments: (day, time) => getWinterAssignmentsForSlot(day, time),
    getAreasUsed: (day, time) => getWinterSlotAreasUsed(day, time),
    getCapacity: () => 3,
  }];
}

function getSummerTrainingPdfSections() {
  return getSummerEnabledVenues().map((venue) => ({
    title: venue.name,
    subtitle: `${formatTrainingAreaLabel(venue.summerTrainingAreas)} available each hour`,
    getAssignments: (day, time) => getSummerAssignmentsForSlot(venue.id, day, time),
    getAreasUsed: (day, time) => getSummerSlotAreasUsed(venue.id, day, time),
    getCapacity: () => venue.summerTrainingAreas,
  }));
}

function renderTrainingPdfSection(section) {
  return `
    <section class="plan-section">
      <div class="section-title">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.subtitle)}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            ${WINTER_TRAINING_DAYS.map((day) => `<th>${escapeHtml(day)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${WINTER_TRAINING_TIMES.map((time) => `
            <tr>
              <th>${escapeHtml(time)}</th>
              ${WINTER_TRAINING_DAYS.map((day) => renderTrainingPdfCell(
                section.getAssignments(day, time),
                section.getAreasUsed(day, time),
                section.getCapacity(day, time)
              )).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
    </section>`;
}

function renderTrainingPdfCell(assignments, areasUsed, capacity) {
  const isFull = areasUsed >= capacity && capacity > 0;
  const assignmentGroups = groupTrainingAssignments(assignments);
  return `
    <td>
      <div class="slot-meta${isFull ? " is-full" : ""}">${escapeHtml(`${areasUsed} of ${capacity} areas used`)}</div>
      ${assignmentGroups.length ? `
        <div class="team-list">
          ${assignmentGroups.map(renderTrainingPdfGroup).join("")}
        </div>
      ` : '<div class="empty-slot">No teams allocated</div>'}
    </td>`;
}

function renderTrainingPdfGroup(group) {
  return `
    <div class="team-card">
      <strong>${escapeHtml(formatTrainingGroupTitle(group))}</strong>
      <span>${escapeHtml(`${formatTrainingGroupFormats(group)} · ${formatTrainingGroupAreaLabel(group)}`)}</span>
    </div>`;
}

function renderTrainingPdfUnassigned(unassignedTeams) {
  if (!unassignedTeams.length) {
    return `
      <section class="unassigned">
        <h2>Unassigned Teams</h2>
        <p class="empty-slot">All teams are assigned.</p>
      </section>`;
  }

  return `
    <section class="unassigned">
      <h2>Unassigned Teams</h2>
      <div class="unassigned-list">
        ${unassignedTeams.map((team) => `
          <div>${escapeHtml(formatTeamDisplayName(team))} · ${escapeHtml(team.format)} · ${escapeHtml(formatTrainingAreaLabel(team.winterTrainingAreas))}</div>
        `).join("")}
      </div>
    </section>`;
}

function renderTrainingPdfEmptyState(planType) {
  const message = planType === "summer"
    ? "No summer venues are configured yet. Set Summer Areas on at least one venue before generating the summer training plan."
    : "No winter training data is available yet.";
  return `<section class="empty-report">${escapeHtml(message)}</section>`;
}

function getUnassignedTrainingTeams(assignments) {
  const assignedIds = new Set(assignments.map((assignment) => assignment.teamId));
  return sortTeams(state.teams).filter((team) => !assignedIds.has(team.id));
}

function setTrainingMessage(text, type) {
  trainingMessage.textContent = text;
  trainingMessage.className = `message ${type}`;
}

function failTrainingEdit(resetFn, message) {
  resetFn();
  setTrainingMessage(message, "error");
}

function renderOptimisedHomePlan() {
  optimisedHomePlan.innerHTML = "";
  const plan = optimiseHomeGamePlan();
  appendAssignmentMoveEditor(plan);
  for (const day of DAYS) {
    const results = plan.slotResults.filter((item) => item.slot.day === day);
    if (!results.length) continue;
    appendPlanBoard(day, `${results.filter((item) => item.teams.length > 0).length} of ${results.length} recurring slots used`, results.map(renderSlotCard).join(""));
  }
  if (!state.matchSlots.length) {
    appendPlanBoard("No Slots Yet", "Add recurring kickoff slots to run the optimiser.", `<p class="empty-state">Create slots with a pitch, day, and kickoff time. The optimiser will fill them automatically.</p>`);
  }

  renderKickoffSuggestions();
  bindPlanLockButtons();
  bindPlanMoveButtons();
}

function renderKickoffSuggestions() {
  kickoffSuggestions.innerHTML = "";

  if (!state.matchSlots.length) {
    const empty = document.createElement("section");
    empty.className = "schedule-board";
    empty.innerHTML = `
      <div class="schedule-board__header">
        <h3>No Suggestions Yet</h3>
        <p>Add kickoff slots first.</p>
      </div>
      <div class="schedule-board__body">
        <p class="empty-state">Suggestions are generated by testing alternate kickoff times against the current optimiser.</p>
      </div>
    `;
    kickoffSuggestions.appendChild(empty);
    return;
  }

  const suggestions = generateKickoffSuggestions();
  if (!suggestions.length) {
    const empty = document.createElement("section");
    empty.className = "schedule-board";
    empty.innerHTML = `
      <div class="schedule-board__header">
        <h3>No Better Kickoffs Found</h3>
        <p>The current kickoff pattern already looks efficient under the present rules.</p>
      </div>
      <div class="schedule-board__body">
        <p class="empty-state">Try adding more slots or changing pitch availability if you need extra capacity.</p>
      </div>
    `;
    kickoffSuggestions.appendChild(empty);
    return;
  }

  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>Suggested Changes</h3>
      <p>${escapeHtml(`${suggestions.length} kickoff tweak${suggestions.length === 1 ? "" : "s"} found`)}</p>
    </div>
    <div class="schedule-board__body">
      ${suggestions.map(renderKickoffSuggestionCard).join("")}
    </div>
  `;
  kickoffSuggestions.appendChild(board);
}

function renderVisualPlanner() {
  visualPlanner.innerHTML = "";
  if (!state.settings.showVisualPlanner) return;

  if (!state.matchSlots.length) {
    visualPlanner.innerHTML = renderVisualPlannerEmpty(
      "No Slots Yet",
      "Add recurring kickoff slots first to generate the timeline view."
    );
    return;
  }

  const plan = optimiseHomeGamePlan();
  const assignedResults = plan.slotResults.filter((result) => result.teams.length > 0);
  if (!assignedResults.length) {
    visualPlanner.innerHTML = renderVisualPlannerEmpty(
      "No Assigned Fixtures Yet",
      "Run the optimiser by adding teams and compatible slots, then this view will show the allocation timeline."
    );
    return;
  }

  visualPlanner.innerHTML = DAYS.map((day) => renderVisualPlannerDay(day, assignedResults))
    .filter(Boolean)
    .join("");
  bindVisualPlannerDragAndDrop(plan);
  bindVisualPlannerLockButtons();
}

function renderVisualPlannerEmpty(title, message) {
  return `
    <section class="schedule-board">
      <div class="schedule-board__header">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="schedule-board__body">
        <p class="empty-state">${escapeHtml(message)}</p>
      </div>
    </section>`;
}

function renderVisualPlannerDay(day, assignedResults) {
  const dayResults = assignedResults
    .filter((result) => result.slot.day === day)
    .sort((a, b) => compareVisualResults(a, b));
  if (!dayResults.length) return "";

  const pitchEntries = getVisualPitchEntries(dayResults);
  const { startMinutes, endMinutes } = getVisualTimelineRange(dayResults);
  const timelineHeight = Math.max(420, timelineMinutesToPixels(endMinutes - startMinutes));
  const gridTemplate = `72px repeat(${pitchEntries.length}, minmax(200px, 1fr))`;
  const labels = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 60) {
    labels.push(`
      <div class="timeline-axis__label" style="top:${minuteOffset(minutes, startMinutes)}px">
        ${escapeHtml(toTimeString(minutes))}
      </div>`);
  }

  return `
    <section class="schedule-board timeline-day-board">
      <div class="schedule-board__header">
        <h3>${escapeHtml(day)}</h3>
        <p>${escapeHtml(`${dayResults.length} assigned kickoff${dayResults.length === 1 ? "" : "s"} across ${pitchEntries.length} pitch${pitchEntries.length === 1 ? "" : "es"}`)}</p>
      </div>
      <div class="timeline-board">
        <div class="timeline-header" style="grid-template-columns:${gridTemplate}">
          <div class="timeline-header__axis">Time</div>
          ${pitchEntries.map((entry) => `
            <div class="timeline-header__pitch">
              <strong>${escapeHtml(entry.venueName)}</strong>
              <span>${escapeHtml(entry.pitchName)}</span>
            </div>`).join("")}
        </div>
        <div class="timeline-body" style="grid-template-columns:${gridTemplate}">
          <div class="timeline-axis" style="height:${timelineHeight}px">
            ${labels.join("")}
          </div>
          ${pitchEntries.map((entry) => renderVisualPitchColumn(entry, dayResults, startMinutes, timelineHeight)).join("")}
        </div>
      </div>
    </section>`;
}

function renderVisualPitchColumn(entry, dayResults, startMinutes, timelineHeight) {
  const pitchResults = dayResults
    .filter((result) => result.slot.pitchId === entry.pitchId)
    .sort((a, b) => a.slot.kickoffTime.localeCompare(b.slot.kickoffTime));
  return `
    <div class="timeline-column" style="height:${timelineHeight}px">
      ${pitchResults.map((result) => renderVisualTimelineBlock(result, startMinutes)).join("")}
    </div>`;
}

function renderVisualTimelineBlock(result, startMinutes) {
  const kickoffMinutes = toClockMinutes(result.slot.kickoffTime);
  const durationMinutes = getVisualResultDurationMinutes(result);
  const endTime = toTimeString(kickoffMinutes + durationMinutes);
  const top = minuteOffset(kickoffMinutes, startMinutes);
  const canWrite = canCurrentUserWrite();
  const lockedTeamIds = new Set(
    result.teams
      .filter((team) => isLockedAssignment(team.id, result.slot.id))
      .map((team) => team.id)
  );
  const fullyLocked = result.teams.length > 0 && lockedTeamIds.size === result.teams.length;
  const height = Math.max(
    timelineMinutesToPixels(durationMinutes),
    estimateVisualBlockHeight(result, lockedTeamIds)
  );
  const teamCountLabel = `${result.teams.length} team${result.teams.length === 1 ? "" : "s"}`;
  return `
    <article class="timeline-block${fullyLocked ? " timeline-block--locked" : ""}" data-drop-slot="${result.slot.id}" style="top:${top}px;height:${height}px">
      <div class="timeline-block__header-row">
        <div>
          <div class="timeline-block__time">${escapeHtml(`${result.slot.kickoffTime} to ${endTime}`)}</div>
          <div class="timeline-block__meta">${escapeHtml(teamCountLabel)}</div>
        </div>
        ${fullyLocked ? '<div class="timeline-block__badge">All Locked</div>' : ""}
      </div>
      <div class="timeline-block__teams">
        ${result.teams.map((team) => `
          <div class="timeline-block__team${lockedTeamIds.has(team.id) ? " timeline-block__team--locked" : ""}" draggable="${canWrite}" data-drag-team="${team.id}" data-origin-slot="${result.slot.id}">
            <strong>${escapeHtml(team.name)}</strong>
            <span>${escapeHtml(`${team.format} · ${team.matchLengthMinutes}m`)}</span>
            ${canWrite && lockedTeamIds.has(team.id) ? `
              <em class="timeline-block__team-badge">Locked</em>
              <button class="timeline-block__team-unlock" type="button" data-visual-unlock="${team.id}|${result.slot.id}" draggable="false">Unlock</button>
            ` : ""}
          </div>`).join("")}
      </div>
    </article>`;
}

function getVisualPitchEntries(results) {
  const entryMap = new Map();
  for (const result of results) {
    const pitch = state.pitches.find((item) => item.id === result.slot.pitchId);
    const venue = pitch ? state.venues.find((item) => item.id === pitch.venueId) : null;
    entryMap.set(result.slot.pitchId, {
      pitchId: result.slot.pitchId,
      pitchName: pitch?.name || "Deleted pitch",
      venueName: venue?.name || "Unknown venue",
    });
  }
  return Array.from(entryMap.values()).sort((a, b) =>
    a.venueName.localeCompare(b.venueName) || a.pitchName.localeCompare(b.pitchName)
  );
}

function getVisualTimelineRange(results) {
  const starts = results.map((result) => toClockMinutes(result.slot.kickoffTime));
  const ends = results.map((result) => toClockMinutes(result.slot.kickoffTime) + getVisualResultDurationMinutes(result));
  const startMinutes = Math.max(6 * 60, Math.floor((Math.min(...starts) - 30) / 60) * 60);
  const endMinutes = Math.min(22 * 60, Math.ceil((Math.max(...ends) + 30) / 60) * 60);
  return {
    startMinutes,
    endMinutes: Math.max(endMinutes, startMinutes + 180),
  };
}

function getVisualResultDurationMinutes(result) {
  if (!result.teams.length) return 60;
  return Math.max(...result.teams.map((team) => requiredPostKickoffMinutesForTeam(team)));
}

function minuteOffset(targetMinutes, startMinutes) {
  return timelineMinutesToPixels(targetMinutes - startMinutes);
}

function timelineMinutesToPixels(minutes) {
  return (minutes / 60) * TIMELINE_PIXELS_PER_HOUR;
}

function estimateVisualBlockHeight(result, lockedTeamIds) {
  const baseHeight = 58;
  const lockedHeight = lockedTeamIds.size === result.teams.length && result.teams.length > 0 ? 8 : 0;
  const teamRowsHeight = result.teams.reduce(
    (total, team) => total + estimateVisualTeamRowHeight(team, lockedTeamIds.has(team.id)),
    0
  );
  return baseHeight + lockedHeight + teamRowsHeight;
}

function estimateVisualTeamRowHeight(team, isLocked) {
  const teamNameLines = Math.ceil(Math.max(1, team.name.length) / 20);
  return 24 + Math.max(0, teamNameLines - 1) * 14 + (isLocked ? 6 : 0);
}

function compareVisualResults(a, b) {
  const pitchA = state.pitches.find((item) => item.id === a.slot.pitchId);
  const pitchB = state.pitches.find((item) => item.id === b.slot.pitchId);
  const venueA = pitchA ? state.venues.find((item) => item.id === pitchA.venueId) : null;
  const venueB = pitchB ? state.venues.find((item) => item.id === pitchB.venueId) : null;
  return (
    a.slot.kickoffTime.localeCompare(b.slot.kickoffTime) ||
    (venueA?.name || "").localeCompare(venueB?.name || "") ||
    (pitchA?.name || "").localeCompare(pitchB?.name || "")
  );
}

function generateKickoffSuggestions() {
  const baselinePlan = optimiseHomeGamePlan();
  const baselineMetrics = getPlanMetrics(baselinePlan);
  const suggestions = [];

  for (const slot of sortMatchSlots(state.matchSlots)) {
    for (const candidateTime of candidateKickoffTimes(slot)) {
      const updatedSlots = state.matchSlots.map((item) =>
        item.id === slot.id ? { ...item, kickoffTime: candidateTime } : item
      );

      const issue = validateMatchSlot({ ...slot, kickoffTime: candidateTime }, slot.id);
      if (issue) continue;

      const candidatePlan = optimiseHomeGamePlan(updatedSlots);
      const candidateMetrics = getPlanMetrics(candidatePlan);
      const improvement = comparePlanMetrics(candidateMetrics, baselineMetrics);
      if (improvement <= 0) continue;

      const pitch = state.pitches.find((item) => item.id === slot.pitchId);
      const venue = pitch ? state.venues.find((item) => item.id === pitch.venueId) : null;
      suggestions.push({
        slotId: slot.id,
        venueName: venue?.name || "Unknown venue",
        pitchName: pitch?.name || "Deleted pitch",
        day: slot.day,
        from: slot.kickoffTime,
        to: candidateTime,
        assignedGain: candidateMetrics.assignedCount - baselineMetrics.assignedCount,
        matchedGain: candidateMetrics.matchedPreferenceCount - baselineMetrics.matchedPreferenceCount,
        newlyPlacedTeams: candidateMetrics.assignedCount > baselineMetrics.assignedCount
          ? candidatePlan.slotResults.flatMap((result) => result.teams).filter((team) => !baselineMetrics.assignedTeamIds.has(team.id)).map((team) => team.name)
          : [],
      });
    }
  }

  return suggestions
    .sort((a, b) =>
      (b.assignedGain - a.assignedGain) ||
      (b.matchedGain - a.matchedGain) ||
      a.day.localeCompare(b.day) ||
      a.to.localeCompare(b.to)
    )
    .filter((suggestion, index, all) =>
      all.findIndex((other) => other.slotId === suggestion.slotId && other.to === suggestion.to) === index
    )
    .slice(0, 8);
}

function renderKickoffSuggestionCard(suggestion) {
  const impactBits = [];
  if (suggestion.assignedGain > 0) impactBits.push(`+${suggestion.assignedGain} team${suggestion.assignedGain === 1 ? "" : "s"} placed`);
  if (suggestion.matchedGain > 0) impactBits.push(`+${suggestion.matchedGain} preference match${suggestion.matchedGain === 1 ? "" : "es"}`);
  if (!impactBits.length) impactBits.push("better overall fit");

  return `
    <section class="venue-panel suggestion-panel">
      <h4>${escapeHtml(suggestion.day)} · ${escapeHtml(suggestion.venueName)} / ${escapeHtml(suggestion.pitchName)}</h4>
      <p class="venue-panel__meta">${escapeHtml(`Move kickoff from ${suggestion.from} to ${suggestion.to}`)}</p>
      <div class="schedule-list">
        <article class="schedule-item">
          <div class="schedule-item__time">${escapeHtml(impactBits.join(" · "))}</div>
          <div class="schedule-item__meta">${suggestion.newlyPlacedTeams.length ? escapeHtml(`Newly placed: ${suggestion.newlyPlacedTeams.join(", ")}`) : "Improves the current allocation pattern without adding another slot."}</div>
        </article>
      </div>
    </section>
  `;
}

function getPlanMetrics(plan) {
  const assignedTeamIds = new Set();
  let matchedPreferenceCount = 0;
  let gregsonBalancedCount = 0;
  let gregsonClashCount = 0;
  const pitchSlotLoads = new Map();

  for (const result of plan.slotResults) {
    if (!pitchSlotLoads.has(result.slot.pitchId)) {
      pitchSlotLoads.set(result.slot.pitchId, 0);
    }
    if (result.teams.length > 0) {
      pitchSlotLoads.set(result.slot.pitchId, pitchSlotLoads.get(result.slot.pitchId) + 1);
    }

    for (const team of result.teams) {
      assignedTeamIds.add(team.id);
      if (team.kickoffPreference === "Either" || kickoffPreferenceScore(team, result.slot) === 0) {
        matchedPreferenceCount += 1;
      }
    }
  }

  const gregsonGroups = new Map();
  for (const result of plan.slotResults) {
    const pitch = state.pitches.find((item) => item.id === result.slot.pitchId);
    const venue = pitch ? state.venues.find((item) => item.id === pitch.venueId) : null;
    if (!isGregsonGreenVenue(venue?.name || "")) continue;
    if (!result.teams.length) continue;

    const key = `${result.slot.day}|${result.slot.kickoffTime}`;
    if (!gregsonGroups.has(key)) gregsonGroups.set(key, []);
    gregsonGroups.get(key).push(result);
  }

  for (const group of gregsonGroups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const formatsA = new Set(group[i].teams.map((team) => team.format));
        const formatsB = new Set(group[j].teams.map((team) => team.format));
        const balanced =
          (formatsA.has("7v7") && formatsB.has("9v9")) ||
          (formatsA.has("9v9") && formatsB.has("7v7"));
        const doubledSeven = formatsA.size === 1 && formatsB.size === 1 && formatsA.has("7v7") && formatsB.has("7v7");
        const doubledNine = formatsA.size === 1 && formatsB.size === 1 && formatsA.has("9v9") && formatsB.has("9v9");

        if (balanced) gregsonBalancedCount += 1;
        if (doubledSeven || doubledNine) gregsonClashCount += 1;
      }
    }
  }

  const pitchLoadPenalty = Array.from(pitchSlotLoads.values()).reduce((total, count) => total + count * count, 0);

  return {
    assignedCount: assignedTeamIds.size,
    matchedPreferenceCount,
    gregsonBalancedCount,
    gregsonClashCount,
    pitchLoadPenalty,
    assignedTeamIds,
  };
}

function comparePlanMetrics(candidate, baseline) {
  if (candidate.assignedCount !== baseline.assignedCount) {
    return candidate.assignedCount - baseline.assignedCount;
  }
  if (candidate.matchedPreferenceCount !== baseline.matchedPreferenceCount) {
    return candidate.matchedPreferenceCount - baseline.matchedPreferenceCount;
  }
  if (candidate.gregsonBalancedCount !== baseline.gregsonBalancedCount) {
    return candidate.gregsonBalancedCount - baseline.gregsonBalancedCount;
  }
  if (candidate.gregsonClashCount !== baseline.gregsonClashCount) {
    return baseline.gregsonClashCount - candidate.gregsonClashCount;
  }
  if (candidate.pitchLoadPenalty !== baseline.pitchLoadPenalty) {
    return baseline.pitchLoadPenalty - candidate.pitchLoadPenalty;
  }
  return 0;
}

function candidateKickoffTimes(slot) {
  const currentMinutes = toClockMinutes(slot.kickoffTime);
  const offsets = [-120, -90, -60, -45, -30, -15, 15, 30, 45, 60, 90, 120];
  const candidates = [];

  for (const offset of offsets) {
    const minutes = currentMinutes + offset;
    if (minutes < LEAGUE_KICKOFF_MIN_MINUTES || minutes > KICKOFF_SUGGESTION_MAX_MINUTES) continue;
    const formatted = toTimeString(minutes);
    if (formatted === slot.kickoffTime) continue;
    candidates.push(formatted);
  }

  return [...new Set(candidates)];
}

function appendPlanBoard(title, subtitle, bodyHtml) {
  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    <div class="schedule-board__body">${bodyHtml}</div>`;
  optimisedHomePlan.appendChild(board);
}

function renderSlotCard(result) {
  const pitch = state.pitches.find((item) => item.id === result.slot.pitchId);
  const venue = pitch ? state.venues.find((item) => item.id === pitch.venueId) : null;
  const canWrite = canCurrentUserWrite();
  const teamsHtml = result.teams.length
    ? result.teams.map((team) => `
        <article class="schedule-item">
          <div class="schedule-item__time">${escapeHtml(team.name)} (${escapeHtml(team.format)})</div>
          <div class="schedule-item__meta">${escapeHtml(`${team.matchLengthMinutes} mins match, ${requiredPostKickoffMinutesForTeam(team)} mins after kickoff, ${requiredMinutesForTeam(team)} mins total footprint`)}</div>
          ${canWrite ? `
            <div class="schedule-item__actions">
              <button class="secondary-btn" type="button" data-open-move="${team.id}">
                Change Slot
              </button>
              <button class="${isLockedAssignment(team.id, result.slot.id) ? "secondary-btn" : ""}" type="button" data-toggle-lock="${team.id}|${result.slot.id}">
                ${isLockedAssignment(team.id, result.slot.id) ? "Unlock Slot" : "Lock Slot"}
              </button>
            </div>
          ` : ""}
        </article>`).join("")
    : `<p class="empty-state">No team assigned to this slot yet.</p>`;
  return `
    <section class="venue-panel">
      <h4>${venue ? escapeHtml(venue.name) : "Unknown venue"} / ${pitch ? escapeHtml(pitch.name) : "Deleted pitch"}</h4>
      <p class="venue-panel__meta">${escapeHtml(`${result.slot.kickoffTime} kickoff · ${describeSlotCapacity(result.slot)} · ${describeRemainingSlotSpace(result)}`)}</p>
      ${result.slot.label ? `<div class="schedule-item__notes">Note: ${escapeHtml(result.slot.label)}</div>` : ""}
      <div class="schedule-list">${teamsHtml}</div>
    </section>`;
}

function renderUnassignedPanel(unassignedTeams) {
  if (!unassignedTeams.length) return `<article class="schedule-item"><div class="schedule-item__time">Unassigned Teams</div><div class="schedule-item__meta">No gaps found by the optimiser.</div></article>`;
  return unassignedTeams.map((item) => `
    <article class="schedule-item warning-item">
      <div class="schedule-item__time">${escapeHtml(item.team.name)} (${escapeHtml(item.team.format)})</div>
      <div class="schedule-item__meta">${escapeHtml(item.reason)}</div>
    </article>`).join("");
}
function renderLockIssues(lockIssues) {
  if (!lockIssues.length) return "";
  return lockIssues.map((issue) => `
    <article class="schedule-item warning-item">
      <div class="schedule-item__time">Locked Assignment Issue</div>
      <div class="schedule-item__meta">${escapeHtml(issue)}</div>
    </article>`).join("");
}

function renderManualMoveOptions(team, currentSlotId, plan = optimiseHomeGamePlan()) {
  const compatibleSlots = sortMatchSlots(state.matchSlots).filter((slot) =>
    canMoveTeamToSlot(team.id, slot.id, plan).allowed
  );
  return compatibleSlots.map((slot) => {
    const pitch = state.pitches.find((item) => item.id === slot.pitchId);
    const venue = pitch ? state.venues.find((item) => item.id === pitch.venueId) : null;
    const selected = slot.id === currentSlotId ? " selected" : "";
    const label = `${slot.day} ${slot.kickoffTime} - ${venue?.name || "Unknown venue"} / ${pitch?.name || "Deleted pitch"}`;
    return `<option value="${escapeHtml(slot.id)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function appendAssignmentMoveEditor(plan) {
  if (!canCurrentUserWrite()) return;
  if (!plannerUiState.moveTeamId) return;
  const team = state.teams.find((item) => item.id === plannerUiState.moveTeamId);
  if (!team) {
    plannerUiState.moveTeamId = null;
    return;
  }

  const currentSlotId = findAssignedSlotIdForTeam(plan, team.id);
  if (!currentSlotId) {
    plannerUiState.moveTeamId = null;
    return;
  }

  const board = document.createElement("section");
  board.className = "schedule-board";
  board.innerHTML = `
    <div class="schedule-board__header">
      <h3>Move ${escapeHtml(team.name)}</h3>
      <p>Choose a compatible slot and lock the team there.</p>
    </div>
    <div class="schedule-board__body">
      <section class="venue-panel planner-editor">
        <label class="planner-editor__field">
          New Slot
          <select id="assignment-move-select">
            ${renderManualMoveOptions(team, currentSlotId, plan)}
          </select>
        </label>
        <div class="planner-editor__actions">
          <button type="button" data-apply-move="${team.id}">Move & Lock</button>
          <button class="secondary-btn" type="button" data-cancel-move="true">Cancel</button>
        </div>
      </section>
    </div>`;
  optimisedHomePlan.appendChild(board);
}

function findAssignedSlotIdForTeam(plan, teamId) {
  const result = plan.slotResults.find((item) => item.teamIds.includes(teamId));
  return result?.slot.id || null;
}
function optimiseHomeGamePlan(slots = state.matchSlots) {
  const teams = sortTeams(state.teams);
  const sortedSlots = sortMatchSlots(slots);
  const seatList = buildSeatList(sortedSlots, teams);
  const slotMap = new Map(sortedSlots.map((slot) => [slot.id, slot]));
  const seatAssignments = Array(seatList.length).fill(null);
  const eligibleSeats = buildEligibleSeatMap(teams, seatList, slotMap, sortedSlots, false);
  const preferredOnlySeats = buildEligibleSeatMap(teams, seatList, slotMap, sortedSlots, true);
  const { validLocks, lockIssues } = resolveLockedAssignments(sortedSlots, seatList, slotMap);

  const preferredTeams = teams.filter((team) => team.kickoffPreference !== "Either");
  const flexibleTeams = teams.filter((team) => team.kickoffPreference === "Either");
  const lockedTeamIds = new Set(validLocks.map((assignment) => assignment.teamId));

  for (const assignment of validLocks) {
    const team = state.teams.find((item) => item.id === assignment.teamId);
    const seatIndex = team ? findAvailableSeatIndexForTeam(team, assignment.slotId, seatList, seatAssignments, slotMap, sortedSlots) : -1;
    if (seatIndex !== -1) {
      seatAssignments[seatIndex] = assignment.teamId;
    }
  }

  for (const team of sortTeamsForAssignment(preferredTeams, preferredOnlySeats)) {
    if (lockedTeamIds.has(team.id)) continue;
    if (assignSeat(team.id, preferredOnlySeats, seatAssignments, new Set(), lockedTeamIds)) {
      lockedTeamIds.add(team.id);
    }
  }

  const remainingTeams = [
    ...teams.filter((team) => !lockedTeamIds.has(team.id) && team.kickoffPreference !== "Either"),
    ...flexibleTeams,
  ];

  for (const team of sortTeamsForAssignment(remainingTeams, eligibleSeats)) {
    assignSeat(team.id, eligibleSeats, seatAssignments, new Set(), lockedTeamIds);
  }

  const assignedTeamIds = new Set();
  const slotResults = sortedSlots.map((slot) => ({ slot, teams: [], teamIds: [] }));
  seatAssignments.forEach((teamId, index) => {
    if (!teamId) return;
    assignedTeamIds.add(teamId);
    const slotResult = slotResults.find((item) => item.slot.id === seatList[index].slotId);
    if (slotResult && !slotResult.teamIds.includes(teamId)) slotResult.teamIds.push(teamId);
  });
  slotResults.forEach((result) => {
    result.teams = result.teamIds.map((teamId) => state.teams.find((team) => team.id === teamId)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  });
  rebalanceSlotResults(slotResults, sortedSlots, lockedTeamIds);
  assignedTeamIds.clear();
  slotResults.forEach((result) => {
    result.teamIds = result.teams.map((team) => team.id);
    result.teams.forEach((team) => assignedTeamIds.add(team.id));
  });
  const unassignedTeams = teams.filter((team) => !assignedTeamIds.has(team.id)).map((team) => ({
    team,
    reason: (eligibleSeats.get(team.id)?.length || 0) === 0
      ? "No compatible recurring slot matches this day, format, and total time requirement."
      : "Compatible slots exist, but there is not enough remaining shared capacity.",
  }));
  return { slotResults, unassignedTeams, assignedTeamIds, lockIssues };
}

function rebalanceSlotResults(slotResults, slots = state.matchSlots, lockedTeamIds = new Set()) {
  let improved = true;

  while (improved) {
    improved = false;
    const baselineMetrics = getPlanMetrics({ slotResults });

    for (let i = 0; i < slotResults.length; i += 1) {
      for (let j = i + 1; j < slotResults.length; j += 1) {
        const candidate = findBetterPairArrangement(slotResults, i, j, slots, baselineMetrics, lockedTeamIds);
        if (!candidate) continue;

        slotResults[i].teams = candidate[i].teams;
        slotResults[i].teamIds = candidate[i].teams.map((team) => team.id);
        slotResults[j].teams = candidate[j].teams;
        slotResults[j].teamIds = candidate[j].teams.map((team) => team.id);
        improved = true;
        break;
      }

      if (improved) break;
    }
  }
}

function findBetterPairArrangement(slotResults, indexA, indexB, slots, baselineMetrics, lockedTeamIds) {
  const resultA = slotResults[indexA];
  const resultB = slotResults[indexB];
  let bestCandidate = null;
  let bestMetrics = baselineMetrics;

  const variants = [];

  for (const teamA of resultA.teams) {
    if (lockedTeamIds.has(teamA.id)) continue;
    if (canAddTeamToSlotResult(teamA, resultB, slots)) {
      variants.push({ moveA: teamA.id, moveB: null });
    }
  }

  for (const teamB of resultB.teams) {
    if (lockedTeamIds.has(teamB.id)) continue;
    if (canAddTeamToSlotResult(teamB, resultA, slots)) {
      variants.push({ moveA: null, moveB: teamB.id });
    }
  }

  for (const teamA of resultA.teams) {
    if (lockedTeamIds.has(teamA.id)) continue;
    for (const teamB of resultB.teams) {
      if (lockedTeamIds.has(teamB.id)) continue;
      if (teamA.id === teamB.id) continue;
      if (!teamFitsSlot(teamA, resultB.slot, slots)) continue;
      if (!teamFitsSlot(teamB, resultA.slot, slots)) continue;
      variants.push({ moveA: teamA.id, moveB: teamB.id });
    }
  }

  for (const variant of variants) {
    const candidate = cloneSlotResults(slotResults);
    const candidateA = candidate[indexA];
    const candidateB = candidate[indexB];

    if (variant.moveA && variant.moveB) {
      const teamA = candidateA.teams.find((team) => team.id === variant.moveA);
      const teamB = candidateB.teams.find((team) => team.id === variant.moveB);
      candidateA.teams = candidateA.teams.filter((team) => team.id !== variant.moveA);
      candidateB.teams = candidateB.teams.filter((team) => team.id !== variant.moveB);
      candidateA.teams.push(teamB);
      candidateB.teams.push(teamA);
    } else if (variant.moveA) {
      const teamA = candidateA.teams.find((team) => team.id === variant.moveA);
      candidateA.teams = candidateA.teams.filter((team) => team.id !== variant.moveA);
      candidateB.teams.push(teamA);
    } else if (variant.moveB) {
      const teamB = candidateB.teams.find((team) => team.id === variant.moveB);
      candidateB.teams = candidateB.teams.filter((team) => team.id !== variant.moveB);
      candidateA.teams.push(teamB);
    }

    candidateA.teams.sort((a, b) => a.name.localeCompare(b.name));
    candidateB.teams.sort((a, b) => a.name.localeCompare(b.name));
    candidateA.teamIds = candidateA.teams.map((team) => team.id);
    candidateB.teamIds = candidateB.teams.map((team) => team.id);

    const metrics = getPlanMetrics({ slotResults: candidate });
    if (comparePlanMetrics(metrics, bestMetrics) > 0) {
      bestCandidate = candidate;
      bestMetrics = metrics;
    }
  }

  return bestCandidate;
}

function cloneSlotResults(slotResults) {
  return slotResults.map((result) => ({
    slot: result.slot,
    teams: [...result.teams],
    teamIds: [...result.teamIds],
  }));
}

function resolveLockedAssignments(slots, seatList, slotMap) {
  const validLocks = [];
  const lockIssues = [];
  const seatAssignments = Array(seatList.length).fill(null);

  for (const assignment of state.lockedAssignments || []) {
    const team = state.teams.find((item) => item.id === assignment.teamId);
    const slot = slots.find((item) => item.id === assignment.slotId);
    if (!team || !slot) {
      lockIssues.push("A saved lock references a team or slot that no longer exists.");
      continue;
    }
    if (!teamFitsSlot(team, slot, slots)) {
      lockIssues.push(`${team.name} can no longer fit the locked slot on ${slot.day} at ${slot.kickoffTime}.`);
      continue;
    }
    const seatIndex = findAvailableSeatIndexForTeam(team, slot.id, seatList, seatAssignments, slotMap, slots);
    if (seatIndex === -1) {
      lockIssues.push(`Too many teams are locked into ${slot.day} ${slot.kickoffTime}.`);
      continue;
    }

    seatAssignments[seatIndex] = assignment.teamId;
    validLocks.push(assignment);
  }

  return { validLocks, lockIssues };
}

function isLockedAssignment(teamId, slotId) {
  return (state.lockedAssignments || []).some((assignment) => assignment.teamId === teamId && assignment.slotId === slotId);
}

function bindPlanLockButtons() {
  if (!canCurrentUserWrite()) return;
  optimisedHomePlan.querySelectorAll("[data-toggle-lock]").forEach((button) => {
    button.addEventListener("click", () => {
      const [teamId, slotId] = String(button.getAttribute("data-toggle-lock") || "").split("|");
      toggleAssignmentLock(teamId, slotId);
    });
  });
}

function bindPlanMoveButtons() {
  if (!canCurrentUserWrite()) return;
  optimisedHomePlan.querySelectorAll("[data-open-move]").forEach((button) => {
    button.addEventListener("click", () => {
      plannerUiState.moveTeamId = String(button.getAttribute("data-open-move") || "") || null;
      renderOptimisedHomePlan();
    });
  });
  optimisedHomePlan.querySelectorAll("[data-apply-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const teamId = String(button.getAttribute("data-apply-move") || "");
      const select = document.getElementById("assignment-move-select");
      moveAssignmentToSlot(teamId, select?.value || "");
    });
  });
  optimisedHomePlan.querySelectorAll("[data-cancel-move]").forEach((button) => {
    button.addEventListener("click", () => {
      plannerUiState.moveTeamId = null;
      renderOptimisedHomePlan();
    });
  });
}

function bindVisualPlannerDragAndDrop(plan) {
  if (!canCurrentUserWrite()) return;
  const dragItems = visualPlanner.querySelectorAll("[data-drag-team]");
  const dropSlots = visualPlanner.querySelectorAll("[data-drop-slot]");

  dragItems.forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      const teamId = String(item.getAttribute("data-drag-team") || "");
      plannerUiState.dragTeamId = teamId || null;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", teamId);
      }
      item.classList.add("is-dragging");
      markVisualDropTargets(teamId, plan);
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("is-dragging");
      plannerUiState.dragTeamId = null;
      clearVisualDropTargets();
    });
  });

  dropSlots.forEach((slot) => {
    slot.addEventListener("dragover", (event) => {
      const teamId = plannerUiState.dragTeamId || event.dataTransfer?.getData("text/plain") || "";
      if (!teamId) return;
      const slotId = String(slot.getAttribute("data-drop-slot") || "");
      const moveCheck = canMoveTeamToSlot(teamId, slotId, plan);
      if (!moveCheck.allowed) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      slot.classList.add("is-drop-hover");
    });

    slot.addEventListener("dragleave", () => {
      slot.classList.remove("is-drop-hover");
    });

    slot.addEventListener("drop", (event) => {
      const teamId = plannerUiState.dragTeamId || event.dataTransfer?.getData("text/plain") || "";
      const slotId = String(slot.getAttribute("data-drop-slot") || "");
      slot.classList.remove("is-drop-hover");
      if (!teamId || !slotId) return;
      event.preventDefault();
      moveAssignmentToSlot(teamId, slotId);
    });
  });
}

function markVisualDropTargets(teamId, plan) {
  visualPlanner.querySelectorAll("[data-drop-slot]").forEach((slot) => {
    const slotId = String(slot.getAttribute("data-drop-slot") || "");
    const moveCheck = canMoveTeamToSlot(teamId, slotId, plan);
    slot.classList.toggle("is-drop-valid", moveCheck.allowed);
    slot.classList.toggle("is-drop-invalid", !moveCheck.allowed);
  });
}

function clearVisualDropTargets() {
  visualPlanner.querySelectorAll("[data-drop-slot]").forEach((slot) => {
    slot.classList.remove("is-drop-valid", "is-drop-invalid", "is-drop-hover");
  });
}

function bindVisualPlannerLockButtons() {
  if (!canCurrentUserWrite()) return;
  visualPlanner.querySelectorAll("[data-visual-unlock]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const [teamId, slotId] = String(button.getAttribute("data-visual-unlock") || "").split("|");
      unlockAssignment(teamId, slotId);
    });
  });
}

function unlockAssignment(teamId, slotId) {
  if (!requireWriteAccess()) return;
  if (!teamId || !slotId) return;
  const existingIndex = state.lockedAssignments.findIndex(
    (assignment) => assignment.teamId === teamId && assignment.slotId === slotId
  );
  if (existingIndex === -1) return;

  state.lockedAssignments.splice(existingIndex, 1);
  saveState();
  renderPlannerOutputs();
  setMessage("Assignment unlocked.", "ok");
}

function toggleAssignmentLock(teamId, slotId) {
  if (!requireWriteAccess()) return;
  if (!teamId || !slotId) return;
  setActiveTab("assignments");

  const existingIndex = state.lockedAssignments.findIndex((assignment) => assignment.teamId === teamId);
  if (existingIndex !== -1 && state.lockedAssignments[existingIndex].slotId === slotId) {
    unlockAssignment(teamId, slotId);
    return;
  }

  const team = state.teams.find((item) => item.id === teamId);
  const slot = state.matchSlots.find((item) => item.id === slotId);
  if (!team || !slot) {
    setMessage("That team or slot no longer exists.", "error");
    return;
  }

  if (existingIndex !== -1) {
    state.lockedAssignments.splice(existingIndex, 1);
  }
  state.lockedAssignments.push({ teamId, slotId });
  saveState();
  renderPlannerOutputs();
  setMessage(`Locked ${team.name} to ${slot.day} ${slot.kickoffTime}.`, "ok");
}

function moveAssignmentToSlot(teamId, slotId) {
  if (!requireWriteAccess()) return;
  if (!teamId || !slotId) return;

  const team = state.teams.find((item) => item.id === teamId);
  const slot = state.matchSlots.find((item) => item.id === slotId);
  if (!team || !slot) {
    setMessage("That team or slot no longer exists.", "error");
    return;
  }
  const moveCheck = canMoveTeamToSlot(teamId, slotId);
  if (!moveCheck.allowed) {
    setMessage(moveCheck.reason || `${team.name} cannot use that slot.`, "error");
    return;
  }

  const existingIndex = state.lockedAssignments.findIndex((assignment) => assignment.teamId === teamId);
  if (existingIndex !== -1) {
    state.lockedAssignments.splice(existingIndex, 1);
  }
  state.lockedAssignments.push({ teamId, slotId });
  saveState();
  plannerUiState.moveTeamId = null;
  renderPlannerOutputs();
  setMessage(`Moved ${team.name} to ${slot.day} ${slot.kickoffTime} and locked it there.`, "ok");
}

function canMoveTeamToSlot(teamId, slotId, plan = optimiseHomeGamePlan()) {
  const team = state.teams.find((item) => item.id === teamId);
  const slot = state.matchSlots.find((item) => item.id === slotId);
  if (!team || !slot) {
    return { allowed: false, reason: "That team or slot no longer exists." };
  }
  if (!teamFitsSlot(team, slot)) {
    return { allowed: false, reason: `${team.name} cannot use that slot.` };
  }

  const currentResult = plan.slotResults.find((result) => result.teamIds.includes(teamId));
  if (!currentResult) {
    return { allowed: false, reason: `${team.name} is not currently assigned.` };
  }
  if (currentResult.slot.id === slotId) {
    return { allowed: true, reason: "" };
  }

  const targetResult = plan.slotResults.find((result) => result.slot.id === slotId);
  if (!targetResult) {
    return { allowed: false, reason: "That slot is not part of the current plan." };
  }

  const adjustedTarget = {
    ...targetResult,
    teams: targetResult.teams.filter((item) => item.id !== teamId),
    teamIds: targetResult.teamIds.filter((id) => id !== teamId),
  };
  if (!canAddTeamToSlotResult(team, adjustedTarget)) {
    return { allowed: false, reason: "That slot does not have enough remaining shared capacity." };
  }

  return { allowed: true, reason: "" };
}

function hideVisualPlannerTab() {
  if (!requireWriteAccess()) return;
  state.settings.showVisualPlanner = false;
  showVisualPlannerInput.checked = false;
  saveState();
  syncVisualPlannerTab();
  renderVisualPlanner();
  setActiveTab("assignments");
  setMessage("Visual planner tab hidden. You can turn it back on in Settings.", "ok");
}

function syncVisualPlannerTab() {
  const currentActive = getActiveTabName();
  tabButtons.forEach((button) => {
    const tabName = button.getAttribute("data-tab-target");
    const visible = !!tabName &&
      userCanAccessTab(tabName) &&
      (tabName !== "visual" || state.settings.showVisualPlanner);
    button.hidden = !visible;
  });
  if (!getAccessibleTabName(currentActive)) {
    setActiveTab("settings");
  }
}

function setActiveTab(tabName) {
  const target = getAccessibleTabName(
    tabName === "visual" && !state.settings.showVisualPlanner ? "assignments" : (tabName || "settings")
  );
  if (!target) return;
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-tab-target") === target);
  });
  tabPanels.forEach((panel) => {
    panel.hidden = panel.getAttribute("data-tab-panel") !== target;
  });
}

function getActiveTabName() {
  const activeButton = Array.from(tabButtons).find((button) => button.classList.contains("is-active"));
  return activeButton?.getAttribute("data-tab-target") || null;
}

function buildEligibleSeatMap(teams, seatList, slotMap, slots, preferredOnly) {
  const eligibleSeats = new Map();
  for (const team of teams) {
    const indexes = seatList
      .map((seat, index) => ({ seat, index }))
      .filter(({ seat }) => seatSupportsTeam(team, seat, slotMap.get(seat.slotId), slots))
      .filter(({ seat }) => !preferredOnly || team.kickoffPreference === "Either" || kickoffPreferenceScore(team, slotMap.get(seat.slotId)) === 0)
      .sort((a, b) =>
        compareSeatPreference(team, slotMap.get(a.seat.slotId), slotMap.get(b.seat.slotId), slots) ||
        compareSeatKindPreference(team, a.seat, b.seat)
      )
      .map(({ index }) => index);
    eligibleSeats.set(team.id, indexes);
  }
  return eligibleSeats;
}

function sortTeamsForAssignment(teams, eligibleSeats) {
  return [...teams].sort((a, b) => {
    const aCount = eligibleSeats.get(a.id)?.length || 0;
    const bCount = eligibleSeats.get(b.id)?.length || 0;
    if (aCount !== bCount) return aCount - bCount;
    if (a.kickoffPreference !== b.kickoffPreference) {
      if (a.kickoffPreference === "Either") return 1;
      if (b.kickoffPreference === "Either") return -1;
    }
    return requiredMinutesForTeam(b) - requiredMinutesForTeam(a);
  });
}

function assignSeat(teamId, eligibleSeats, seatAssignments, seen, lockedTeamIds = new Set()) {
  for (const seatIndex of eligibleSeats.get(teamId) || []) {
    if (seen.has(seatIndex)) continue;
    seen.add(seatIndex);
    const current = seatAssignments[seatIndex];
    if (!current) {
      seatAssignments[seatIndex] = teamId;
      return true;
    }
    if (lockedTeamIds.has(current)) continue;
    if (assignSeat(current, eligibleSeats, seatAssignments, seen, lockedTeamIds)) {
      seatAssignments[seatIndex] = teamId;
      return true;
    }
  }
  return false;
}

function buildSeatList(slots, teams = state.teams) {
  return slots.flatMap((slot) => [
    { slotId: slot.id, kind: "primary" },
    { slotId: slot.id, kind: "secondary" },
  ]);
}

function seatSupportsTeam(team, seat, slot, slots = state.matchSlots) {
  if (!teamFitsSlot(team, slot, slots)) return false;
  if (team.format === "3v3") return seat.kind === "primary";
  return true;
}

function compareSeatKindPreference(team, seatA, seatB) {
  if (team.format !== "3v3") return 0;
  const scoreA = seatA.kind === "primary" ? 0 : 1;
  const scoreB = seatB.kind === "primary" ? 0 : 1;
  return scoreA - scoreB;
}

function findAvailableSeatIndexForTeam(team, slotId, seatList, seatAssignments, slotMap, slots = state.matchSlots) {
  return seatList.findIndex(
    (seat, index) =>
      seat.slotId === slotId &&
      seatAssignments[index] === null &&
      seatSupportsTeam(team, seat, slotMap.get(slotId), slots)
  );
}

function canAddTeamToSlotResult(team, result, slots = state.matchSlots) {
  if (!teamFitsSlot(team, result.slot, slots)) return false;
  if (team.format === "3v3") return result.teams.length === 0;
  if (result.teams.some((item) => item.format === "3v3")) return false;
  return result.teams.filter((item) => item.format !== "3v3").length < 2;
}

function describeRemainingSlotSpace(result) {
  const regularTeamCount = result.teams.filter((team) => team.format !== "3v3").length;
  const threeV3Count = result.teams.filter((team) => team.format === "3v3").length;
  const regularSpare = Math.max(0, 2 - regularTeamCount);
  if (threeV3Count > 0) {
    return threeV3Count > 1
      ? `${threeV3Count} x 3v3 teams assigned`
      : "3v3 slot locked to one team";
  }
  return `${regularSpare} spare space${regularSpare === 1 ? "" : "s"}`;
}

function compareSeatPreference(team, slotA, slotB, slots = state.matchSlots) {
  const preferenceA = kickoffPreferenceScore(team, slotA);
  const preferenceB = kickoffPreferenceScore(team, slotB);
  if (preferenceA !== preferenceB) return preferenceA - preferenceB;
  const gregsonPreferenceA = gregsonGreenPairingScore(team, slotA, slots);
  const gregsonPreferenceB = gregsonGreenPairingScore(team, slotB, slots);
  if (gregsonPreferenceA !== gregsonPreferenceB) return gregsonPreferenceA - gregsonPreferenceB;
  const slackA = slotCapacityMinutes(slotA, slots) - requiredPostKickoffMinutesForTeam(team);
  const slackB = slotCapacityMinutes(slotB, slots) - requiredPostKickoffMinutesForTeam(team);
  if (slackA !== slackB) return slackA - slackB;
  if (slotA.day !== slotB.day) return dayIndex(slotA.day) - dayIndex(slotB.day);
  if (slotA.kickoffTime !== slotB.kickoffTime) return slotA.kickoffTime.localeCompare(slotB.kickoffTime);
  return slotA.id.localeCompare(slotB.id);
}

function teamFitsSlot(team, slot, slots = state.matchSlots) {
  const pitch = state.pitches.find((item) => item.id === slot?.pitchId);
  if (!pitch) return false;
  if (team.matchDay !== slot.day) return false;
  if (!pitch.formats.includes(team.format)) return false;
  if (pitch.usage !== "Both" && pitch.usage !== "Match") return false;
  return slotCapacityMinutes(slot, slots) >= requiredPostKickoffMinutesForTeam(team);
}

function requiredMinutesForTeam(team) {
  return state.settings.warmupMinutes + team.matchLengthMinutes + state.settings.packAwayMinutes;
}

function requiredPostKickoffMinutesForTeam(team) {
  return team.matchLengthMinutes + state.settings.packAwayMinutes;
}

function slotCapacityMinutes(slot, slots = state.matchSlots) {
  const nextKickoff = getNextKickoffOnPitch(slot, slots);
  if (!nextKickoff) return Number.POSITIVE_INFINITY;
  return Math.max(0, minutesBetween(slot.kickoffTime, nextKickoff.kickoffTime) - state.settings.warmupMinutes);
}

function getNextKickoffOnPitch(slot, slots = state.matchSlots) {
  return sortMatchSlots(
    slots.filter(
      (item) =>
        item.pitchId === slot.pitchId &&
        item.day === slot.day &&
        item.id !== slot.id &&
        item.kickoffTime > slot.kickoffTime
    )
  )[0] || null;
}

function describeSlotCapacity(slot, slots = state.matchSlots) {
  const nextKickoff = getNextKickoffOnPitch(slot, slots);
  if (!nextKickoff) return "Open-ended after kickoff";
  return `${formatMinutes(slotCapacityMinutes(slot, slots))} before warmup for ${nextKickoff.kickoffTime}`;
}

function startEditTeam(teamId) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return setMessage("That team could not be found.", "error");
  setActiveTab("teams");
  editState.teamId = teamId;
  teamForm.elements.name.value = team.name;
  teamForm.elements.ageGroup.value = team.ageGroup;
  teamForm.elements.colour.value = team.colour;
  teamForm.elements.format.value = team.format;
  teamForm.elements.gender.value = team.gender;
  teamForm.elements.matchDay.value = team.matchDay;
  teamForm.elements.matchLengthMinutes.value = team.matchLengthMinutes;
  teamForm.elements.kickoffPreference.value = team.kickoffPreference;
  teamForm.elements.winterTrainingAreas.value = String(team.winterTrainingAreas);
  teamForm.elements.winterTrainingPreference.value = team.winterTrainingPreference;
  teamForm.elements.manager.value = team.manager;
  teamForm.elements.assistantManager.value = team.assistantManager;
  syncEditorButtons();
}

function startEditVenue(venueId) {
  const venue = state.venues.find((item) => item.id === venueId);
  if (!venue) return setMessage("That venue could not be found.", "error");
  setActiveTab("venues");
  editState.venueId = venueId;
  venueForm.elements.name.value = venue.name;
  venueForm.elements.summerTrainingAreas.value = String(venue.summerTrainingAreas || 0);
  venueForm.elements.address.value = venue.address || "";
  syncEditorButtons();
}

function startEditPitch(pitchId) {
  const pitch = state.pitches.find((item) => item.id === pitchId);
  if (!pitch) return setMessage("That pitch could not be found.", "error");
  setActiveTab("venues");
  editState.pitchId = pitchId;
  renderPitchVenueOptions(pitch.venueId);
  pitchForm.elements.name.value = pitch.name;
  pitchForm.elements.usage.value = pitch.usage;
  pitchForm.elements.overlayGroup.value = pitch.overlayGroup || "";
  pitchForm.elements.slotDay.value = "";
  pitchForm.elements.kickoffTimes.value = "";
  for (const option of pitchForm.elements.formats.options) option.selected = pitch.formats.includes(option.value);
  syncEditorButtons();
}

function startEditSlot(slotId) {
  const slot = state.matchSlots.find((item) => item.id === slotId);
  if (!slot) return setMessage("That slot could not be found.", "error");
  setActiveTab("facilities");
  editState.slotId = slotId;
  renderSlotPitchOptions(slot.pitchId);
  slotDaySelect.value = slot.day;
  slotForm.elements.kickoffTime.value = slot.kickoffTime;
  slotForm.elements.label.value = slot.label || "";
  syncEditorButtons();
}

function startEditFriendlyBooking(bookingId) {
  if (!requireFriendlyWriteAccess()) return;
  const booking = state.friendlyBookings.find((item) => item.id === bookingId);
  if (!booking) return setFriendlyMessage("That friendly booking could not be found.", "error");
  setActiveTab("friendlies");
  editState.friendlyBookingId = bookingId;
  plannerUiState.friendlyPendingPitchId = booking.pitchId;
  renderFriendlyTeamOptions(booking.teamId);
  renderFriendlyPitchOptions(booking.pitchId);
  friendlyDateInput.value = booking.date;
  friendlyKickoffInput.value = booking.kickoffTime;
  friendlyDurationSelect.value = String(booking.durationMinutes);
  friendlyOpponentInput.value = booking.opponent || "";
  friendlyNotesInput.value = booking.notes || "";
  friendlyCalendarMonthInput.value = booking.date.slice(0, 7);
  renderFriendlyDayBoard();
  renderFriendlyCalendar();
  syncEditorButtons();
}

function startEditPitchBlock(blockId) {
  const block = state.pitchBlocks.find((item) => item.id === blockId);
  if (!block) return setFriendlyMessage("That pitch block could not be found.", "error");
  setActiveTab("friendlies");
  editState.pitchBlockId = blockId;
  renderPitchBlockPitchOptions(block.pitchId);
  pitchBlockStartDateInput.value = getPitchBlockStartDate(block);
  pitchBlockEndDateInput.value = getPitchBlockEndDate(block);
  pitchBlockStartInput.value = block.startTime;
  pitchBlockEndInput.value = block.endTime;
  pitchBlockReasonInput.value = block.reason || "";
  friendlyDateInput.value = getPitchBlockStartDate(block);
  friendlyCalendarMonthInput.value = getPitchBlockStartDate(block).slice(0, 7);
  renderFriendlyDayBoard();
  renderFriendlyCalendar();
  syncEditorButtons();
}

function resetTeamForm() {
  editState.teamId = null;
  teamForm.reset();
  teamForm.elements.winterTrainingAreas.value = "1";
  teamForm.elements.winterTrainingPreference.value = "18:00";
  syncEditorButtons();
}
function resetVenueForm() {
  editState.venueId = null;
  venueForm.reset();
  venueForm.elements.summerTrainingAreas.value = "0";
  syncEditorButtons();
}
function resetPitchForm() { editState.pitchId = null; pitchForm.reset(); renderPitchVenueOptions(); syncEditorButtons(); }
function resetSlotForm() { editState.slotId = null; slotForm.reset(); renderSlotPitchOptions(); syncEditorButtons(); }
function resetFriendlyBookingForm({ keepMessage = false } = {}) {
  editState.friendlyBookingId = null;
  plannerUiState.friendlyPendingPitchId = null;
  friendlyBookingForm.reset();
  friendlyDurationSelect.value = "90";
  friendlyDateInput.value = toDateInputValue(new Date());
  friendlyKickoffInput.value = "10:00";
  renderFriendlyTeamOptions();
  renderFriendlyPitchOptions();
  renderFriendlyDayBoard();
  syncEditorButtons();
  if (!keepMessage) setFriendlyMessage("", "ok");
}
function resetPitchBlockForm({ keepMessage = false } = {}) {
  editState.pitchBlockId = null;
  pitchBlockForm.reset();
  pitchBlockStartDateInput.value = friendlyDateInput.value || toDateInputValue(new Date());
  pitchBlockEndDateInput.value = pitchBlockStartDateInput.value;
  pitchBlockStartInput.value = "10:00";
  pitchBlockEndInput.value = "11:00";
  renderPitchBlockPitchOptions();
  syncEditorButtons();
  if (!keepMessage) setFriendlyMessage("", "ok");
}

function syncEditorButtons() {
  teamSubmitBtn.textContent = editState.teamId ? "Save Team Changes" : "Add Team";
  venueSubmitBtn.textContent = editState.venueId ? "Save Venue Changes" : "Add Venue";
  pitchSubmitBtn.textContent = editState.pitchId ? "Save Pitch Changes" : "Add Pitch";
  slotSubmitBtn.textContent = editState.slotId ? "Save Slot Changes" : "Add Slot";
  friendlySubmitBtn.textContent = editState.friendlyBookingId ? "Save Friendly Booking" : "Add Friendly Booking";
  pitchBlockSubmitBtn.textContent = editState.pitchBlockId ? "Save Pitch Block" : "Add Pitch Block";
  winterSubmitBtn.textContent = editState.winterTeamId ? "Save Winter Changes" : "Assign Winter Slot";
  summerSubmitBtn.textContent = editState.summerTeamId ? "Save Summer Changes" : "Assign Summer Slot";
  userSubmitBtn.textContent = editState.userId ? "Save User Changes" : "Add User";
  teamCancelBtn.hidden = !editState.teamId;
  venueCancelBtn.hidden = !editState.venueId;
  pitchCancelBtn.hidden = !editState.pitchId;
  slotCancelBtn.hidden = !editState.slotId;
  friendlyCancelBtn.hidden = !editState.friendlyBookingId;
  pitchBlockCancelBtn.hidden = !editState.pitchBlockId;
  winterCancelBtn.hidden = !editState.winterTeamId;
  summerCancelBtn.hidden = !editState.summerTeamId;
  userCancelBtn.hidden = !editState.userId;
}
function deleteTeam(teamId) {
  if (!requireWriteAccess()) return;
  state.teams = state.teams.filter((team) => team.id !== teamId);
  state.friendlyBookings = state.friendlyBookings.filter((booking) => booking.teamId !== teamId);
  state.lockedAssignments = state.lockedAssignments.filter((assignment) => assignment.teamId !== teamId);
  state.winterTrainingAssignments = state.winterTrainingAssignments.filter((assignment) => assignment.teamId !== teamId);
  state.summerTrainingAssignments = state.summerTrainingAssignments.filter((assignment) => assignment.teamId !== teamId);
  if (editState.teamId === teamId) resetTeamForm();
  if (editState.winterTeamId === teamId) resetWinterAssignmentForm();
  if (editState.summerTeamId === teamId) {
    resetSummerTrainingForm();
  }
  if (
    editState.friendlyBookingId &&
    !state.friendlyBookings.some((booking) => booking.id === editState.friendlyBookingId)
  ) {
    resetFriendlyBookingForm();
  }
  saveState();
  renderTeams();
  renderFriendlyBookingPlanner();
  renderPlannerOutputs();
  renderWinterTrainingPlanner();
  renderSummerTrainingPlanner();
  setMessage("Team deleted.", "ok");
}

function deleteVenue(venueId) {
  if (!requireWriteAccess()) return;
  const deletedPitchIds = state.pitches.filter((pitch) => pitch.venueId === venueId).map((pitch) => pitch.id);
  const deletedSlotIds = state.matchSlots.filter((slot) => deletedPitchIds.includes(slot.pitchId)).map((slot) => slot.id);
  state.venues = state.venues.filter((venue) => venue.id !== venueId);
  state.pitches = state.pitches.filter((pitch) => pitch.venueId !== venueId);
  state.matchSlots = state.matchSlots.filter((slot) => !deletedPitchIds.includes(slot.pitchId));
  state.friendlyBookings = state.friendlyBookings.filter((booking) => !deletedPitchIds.includes(booking.pitchId));
  state.pitchBlocks = state.pitchBlocks.filter((block) => !deletedPitchIds.includes(block.pitchId));
  state.lockedAssignments = state.lockedAssignments.filter((assignment) => !deletedSlotIds.includes(assignment.slotId));
  state.summerTrainingAssignments = state.summerTrainingAssignments.filter((assignment) => assignment.venueId !== venueId);
  if (editState.venueId === venueId) resetVenueForm();
  if (editState.pitchId && deletedPitchIds.includes(editState.pitchId)) resetPitchForm();
  if (editState.slotId && !state.matchSlots.some((slot) => slot.id === editState.slotId)) resetSlotForm();
  if (
    editState.friendlyBookingId &&
    !state.friendlyBookings.some((booking) => booking.id === editState.friendlyBookingId)
  ) {
    resetFriendlyBookingForm();
  }
  if (
    editState.pitchBlockId &&
    !state.pitchBlocks.some((block) => block.id === editState.pitchBlockId)
  ) {
    resetPitchBlockForm();
  }
  if (editState.summerTeamId && !state.summerTrainingAssignments.some((assignment) => assignment.teamId === editState.summerTeamId)) {
    resetSummerTrainingForm();
  }
  saveState();
  renderVenues();
  renderPitchVenueOptions();
  renderPitches();
  renderSlotPitchOptions();
  renderMatchSlots();
  renderFriendlyBookingPlanner();
  renderPlannerOutputs();
  renderSummerTrainingPlanner();
  setMessage("Venue deleted with its pitches, recurring match slots, friendly bookings, pitch blocks, and linked summer training assignments.", "ok");
}

function deletePitch(pitchId) {
  if (!requireWriteAccess()) return;
  const deletedSlotIds = state.matchSlots.filter((slot) => slot.pitchId === pitchId).map((slot) => slot.id);
  state.pitches = state.pitches.filter((pitch) => pitch.id !== pitchId);
  state.matchSlots = state.matchSlots.filter((slot) => slot.pitchId !== pitchId);
  state.friendlyBookings = state.friendlyBookings.filter((booking) => booking.pitchId !== pitchId);
  state.pitchBlocks = state.pitchBlocks.filter((block) => block.pitchId !== pitchId);
  state.lockedAssignments = state.lockedAssignments.filter((assignment) => !deletedSlotIds.includes(assignment.slotId));
  if (editState.pitchId === pitchId) resetPitchForm();
  if (editState.slotId && !state.matchSlots.some((slot) => slot.id === editState.slotId)) resetSlotForm();
  if (
    editState.friendlyBookingId &&
    !state.friendlyBookings.some((booking) => booking.id === editState.friendlyBookingId)
  ) {
    resetFriendlyBookingForm();
  }
  if (
    editState.pitchBlockId &&
    !state.pitchBlocks.some((block) => block.id === editState.pitchBlockId)
  ) {
    resetPitchBlockForm();
  }
  saveState();
  renderPitches();
  renderSlotPitchOptions();
  renderMatchSlots();
  renderFriendlyBookingPlanner();
  renderPlannerOutputs();
  setMessage("Pitch deleted with its recurring match slots, friendly bookings, and pitch blocks.", "ok");
}

function deleteMatchSlot(slotId) {
  if (!requireWriteAccess()) return;
  state.matchSlots = state.matchSlots.filter((slot) => slot.id !== slotId);
  state.lockedAssignments = state.lockedAssignments.filter((assignment) => assignment.slotId !== slotId);
  if (editState.slotId === slotId) resetSlotForm();
  saveState();
  renderMatchSlots();
  renderPlannerOutputs();
  setMessage("Recurring kickoff slot deleted.", "ok");
}

function deleteFriendlyBooking(bookingId) {
  if (!requireFriendlyWriteAccess()) return;
  state.friendlyBookings = state.friendlyBookings.filter((booking) => booking.id !== bookingId);
  if (editState.friendlyBookingId === bookingId) resetFriendlyBookingForm();
  saveState({ allowFriendliesWrite: true });
  renderFriendlyBookingPlanner();
  setFriendlyMessage("Friendly booking deleted.", "ok");
}

function deletePitchBlock(blockId) {
  if (!requireWriteAccess()) return;
  state.pitchBlocks = state.pitchBlocks.filter((block) => block.id !== blockId);
  if (editState.pitchBlockId === blockId) resetPitchBlockForm();
  saveState();
  renderFriendlyBookingPlanner();
  setFriendlyMessage("Pitch block deleted.", "ok");
}

function onExport() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gregson-lane-pitch-manager-${state.season.name.replace(/\W+/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setMessage("Data exported.", "ok");
}

function onImport(event) {
  if (!requireWriteAccess()) return;
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result.toString());
      if (Array.isArray(imported?.seasons) && imported?.seasonStates && typeof imported.seasonStates === "object") {
        const importedSeasonId = imported.activeSeasonId || imported.seasons[0];
        state = normalizeState(imported.seasonStates?.[importedSeasonId] || {});
      } else {
        state = normalizeState(imported);
      }
      Object.assign(editState, {
        teamId: null,
        venueId: null,
        pitchId: null,
        slotId: null,
        friendlyBookingId: null,
        pitchBlockId: null,
        winterTeamId: null,
        summerTeamId: null,
        userId: null,
      });
      saveState();
      renderAll();
      setMessage(`Data imported into ${state.season.name}.`, "ok");
    } catch {
      setMessage("Import failed. Please select a valid JSON export file.", "error");
    }
  };
  reader.readAsText(file);
}

function failEdit(resetFn, message) {
  resetFn();
  setMessage(message, "error");
}

function bindRowActions(root, action, handler) {
  root.querySelectorAll(`[data-${action}]`).forEach((button) =>
    button.addEventListener("click", () => handler(button.getAttribute(`data-${action}`)))
  );
}

function setMessage(text, type) {
  plannerMessage.textContent = text;
  plannerMessage.className = `message ${type}`;
}

function setFriendlyMessage(text, type) {
  friendlyMessage.textContent = text;
  friendlyMessage.className = `message ${type}`;
}

function isMatchCapablePitch(pitch) {
  return pitch?.usage === "Both" || pitch?.usage === "Match";
}

function normalizeDateInput(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? raw : "";
}

function normalizeTimeInput(value) {
  const raw = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return "";
  const [hours, minutes] = raw.split(":").map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? raw : "";
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDatesInRange(startDate, endDate) {
  const start = normalizeDateInput(startDate);
  const end = normalizeDateInput(endDate);
  if (!start || !end || end < start) return [];
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const cursor = new Date(startYear, startMonth - 1, startDay);
  const last = new Date(endYear, endMonth - 1, endDay);
  const dates = [];
  while (cursor <= last) {
    dates.push(toDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function toMonthInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatDateLabel(value) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sortTeams(teams) {
  return [...teams].sort((a, b) =>
    compareTeamAgeGroup(a.ageGroup, b.ageGroup) ||
    a.name.localeCompare(b.name)
  );
}

function compareTeamAgeGroup(ageGroupA, ageGroupB) {
  return getAgeSortKey(ageGroupA) - getAgeSortKey(ageGroupB);
}

function getAgeSortKey(ageGroup) {
  const normalized = String(ageGroup || "").trim().toLowerCase();
  if (!normalized) return 999;
  if (normalized.includes("adult") || normalized.includes("open")) return 0;
  if (normalized.includes("senior") && !normalized.includes("u")) return 0;

  const match = normalized.match(/u\s*(\d{1,2})/i);
  if (match) return 100 - Number.parseInt(match[1], 10);

  const firstNumber = normalized.match(/(\d{1,2})/);
  if (firstNumber) return 100 - Number.parseInt(firstNumber[1], 10);

  return 999;
}

function sortPitches(pitches) {
  return [...pitches].sort((a, b) => {
    const venueA = state.venues.find((venue) => venue.id === a.venueId)?.name || "Unknown venue";
    const venueB = state.venues.find((venue) => venue.id === b.venueId)?.name || "Unknown venue";
    return venueA.localeCompare(venueB) || a.name.localeCompare(b.name);
  });
}

function sortMatchSlots(slots) {
  return [...slots].sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.kickoffTime.localeCompare(b.kickoffTime));
}

function dayIndex(day) {
  const index = DAYS.indexOf(day);
  return index === -1 ? 99 : index;
}

function getVenueName(venueId) {
  return state.venues.find((venue) => venue.id === venueId)?.name || "Unknown venue";
}

function getSummerSlotLoadRatio(venueId, day, time) {
  const venue = state.venues.find((item) => item.id === venueId);
  const capacity = Math.max(venue?.summerTrainingAreas || 0, 1);
  return getSummerSlotAreasUsed(venueId, day, time) / capacity;
}

function isGregsonGreenVenue(name) {
  return String(name || "").toLowerCase().includes("gregson green");
}

function gregsonGreenPairingScore(team, slot, slots = state.matchSlots) {
  if (!slot || (team.format !== "7v7" && team.format !== "9v9")) return 0;

  const pitch = state.pitches.find((item) => item.id === slot.pitchId);
  const venue = pitch ? state.venues.find((item) => item.id === pitch.venueId) : null;
  if (!isGregsonGreenVenue(venue?.name || "")) return 0;

  const partnerFormat = team.format === "7v7" ? "9v9" : "7v7";
  const siblingPitches = slots
    .filter(
      (item) =>
        item.id !== slot.id &&
        item.day === slot.day &&
        item.kickoffTime === slot.kickoffTime
    )
    .map((item) => state.pitches.find((candidate) => candidate.id === item.pitchId))
    .filter((candidate) => candidate && candidate.venueId === pitch.venueId);

  if (!siblingPitches.length) return 1;

  const hasComplementarySibling = siblingPitches.some((candidate) => candidate.formats.includes(partnerFormat));
  if (hasComplementarySibling) return 0;

  const hasSameFormatSibling = siblingPitches.some((candidate) => candidate.formats.includes(team.format));
  if (hasSameFormatSibling) return 2;

  return 1;
}

function normalizeKickoffPreference(value) {
  return value === "AM" || value === "PM" ? value : "Either";
}

function normalizeWinterTrainingAreas(value) {
  return String(value) === "2" || Number(value) === 2 ? 2 : 1;
}

function normalizeWinterTrainingPreference(value) {
  return WINTER_TRAINING_TIMES.includes(String(value)) ? String(value) : "18:00";
}

function formatTrainingAreaLabel(count) {
  return `${count} area${count === 1 ? "" : "s"}`;
}

function getAvailableTrainingTeams(assignments, selectedTeamId = "") {
  const assignedIds = new Set(
    assignments
      .map((assignment) => assignment.teamId)
      .filter((teamId) => teamId && teamId !== selectedTeamId)
  );
  return sortTeams(state.teams.filter((team) => !assignedIds.has(team.id)));
}

function formatTeamDisplayName(team) {
  if (!team) return "";
  const name = String(team.name || "").trim();
  const colour = String(team.colour || "").trim();
  return colour ? `${name} ${colour}` : name;
}

function kickoffPreferenceScore(team, slot) {
  if (team.kickoffPreference === "Either") return 0;
  return slotKickoffPeriod(slot.kickoffTime) === team.kickoffPreference ? 0 : 1;
}

function slotKickoffPeriod(startTime) {
  return toClockMinutes(startTime) < 12 * 60 ? "AM" : "PM";
}

function minutesBetween(startTime, endTime) {
  return toClockMinutes(endTime) - toClockMinutes(startTime);
}

function toClockMinutes(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function timesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function formatMinutes(minutes) {
  return `${minutes} mins`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


