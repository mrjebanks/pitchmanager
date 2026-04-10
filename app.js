const APP_VERSION = "V1.1";
const INDEXED_DB_NAME = "gljfc-pitch-manager";
const INDEXED_DB_VERSION = 1;
const INDEXED_DB_STORE = "appState";
const INDEXED_DB_RECORD_KEY = "current";
const LEGACY_LOCAL_STORAGE_KEYS = ["gljfc-pitch-manager-v1_1", "gljfc-pitch-manager-v1"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WINTER_TRAINING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const WINTER_TRAINING_TIMES = ["18:00", "19:00", "20:00"];
const TIMELINE_PIXELS_PER_HOUR = 88;
const REMOTE_STATE_RECORD_ID = "current";
const TAB_DEFINITIONS = [
  { id: "settings", label: "Settings" },
  { id: "teams", label: "Teams" },
  { id: "venues", label: "Venues" },
  { id: "facilities", label: "Match Setup" },
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
  settings: { warmupMinutes: 30, packAwayMinutes: 15, showVisualPlanner: true },
  teams: [],
  venues: [],
  pitches: [],
  matchSlots: [],
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
  winterTeamId: null,
  summerTeamId: null,
  userId: null,
};
const plannerUiState = { moveTeamId: null, dragTeamId: null };
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
const winterSubmitBtn = document.getElementById("winter-submit-btn");
const winterCancelBtn = document.getElementById("winter-cancel-btn");
const winterAutoBtn = document.getElementById("winter-auto-btn");
const winterClearBtn = document.getElementById("winter-clear-btn");
const winterTrainingBoard = document.getElementById("winter-training-board");
const winterTrainingVisual = document.getElementById("winter-training-visual");
const summerTrainingForm = document.getElementById("summer-training-form");
const summerTeamSelect = document.getElementById("summer-team");
const summerVenueSelect = document.getElementById("summer-venue");
const summerDaySelect = summerTrainingForm.elements.day;
const summerTimeSelect = summerTrainingForm.elements.time;
const summerSubmitBtn = document.getElementById("summer-submit-btn");
const summerCancelBtn = document.getElementById("summer-cancel-btn");
const summerAutoBtn = document.getElementById("summer-auto-btn");
const summerClearBtn = document.getElementById("summer-clear-btn");
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
  summerAutoBtn.addEventListener("click", autoFillSummerAssignments);
  summerClearBtn.addEventListener("click", clearSummerAssignments);
  summerCancelBtn.addEventListener("click", resetSummerTrainingForm);
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
  renderTeams();
  renderVenues();
  renderPitchVenueOptions();
  renderPitches();
  renderSlotPitchOptions();
  renderMatchSlots();
  renderPlannerOutputs();
  renderWinterTrainingPlanner();
  renderSummerTrainingPlanner();
  renderUsers();
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
    }))
    .filter((assignment) => assignment.teamId && assignment.venueId)
    .filter(
      (assignment, index, all) =>
        all.findIndex((candidate) => candidate.teamId === assignment.teamId) === index
    );
  return {
    season: { ...defaultData.season, ...(rawState.season || {}) },
    settings: {
      warmupMinutes: toPositiveInt(rawState.settings?.warmupMinutes, defaultData.settings.warmupMinutes),
      packAwayMinutes: toPositiveInt(rawState.settings?.packAwayMinutes, defaultData.settings.packAwayMinutes),
      showVisualPlanner: toBoolean(rawState.settings?.showVisualPlanner, defaultData.settings.showVisualPlanner),
    },
    teams,
    venues,
    pitches,
    matchSlots,
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

async function saveState() {
  persistCurrentSeasonInStore();
  if (authState.enabled) {
    await saveRemoteState();
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

async function saveRemoteState() {
  if (!canCurrentUserWrite()) return;
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

function requireWriteAccess() {
  if (canCurrentUserWrite()) return true;
  setMessage("This account is read-only.", "error");
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
  const manageUsersAllowed = isCurrentUserAdmin();
  const editableForms = [
    seasonForm,
    settingsForm,
    teamForm,
    venueForm,
    pitchForm,
    slotForm,
    winterAssignmentForm,
    summerTrainingForm,
  ];

  editableForms.forEach((form) => toggleFormDisabled(form, !writeAllowed));
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
    resetTeamForm();
    return setMessage("Team updated.", "ok");
  }
  state.teams.push({ id: id("team"), ...payload });
  saveState();
  renderTeams();
  renderPlannerOutputs();
  renderWinterTrainingPlanner();
  renderSummerTrainingPlanner();
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
    resetVenueForm();
    return setMessage("Venue updated.", "ok");
  }
  state.venues.push({ id: id("venue"), ...payload });
  saveState();
  renderVenues();
  renderPitchVenueOptions();
  renderSlotPitchOptions();
  renderSummerTrainingPlanner();
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
  }

  return { error: null, values: [...new Set(values)].sort((a, b) => a.localeCompare(b)) };
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

function renderPlannerOutputs() {
  renderOptimisedHomePlan();
  renderVisualPlanner();
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
                <div class="schedule-item__time">${escapeHtml(team.name)} (${escapeHtml(team.format)})</div>
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
  const areasUsed = assignments.reduce((total, assignment) => total + assignment.team.winterTrainingAreas, 0);
  const canWrite = canCurrentUserWrite();
  return `
    <section class="venue-panel training-slot-panel">
      <h4>${escapeHtml(day)}</h4>
      <p class="venue-panel__meta">${escapeHtml(`${areasUsed} of 3 areas used at ${time}`)}</p>
      <div class="schedule-list">
        ${assignments.length
          ? assignments.map((assignment) => `
            <article class="schedule-item">
              <div class="schedule-item__time">${escapeHtml(assignment.team.name)}</div>
              <div class="schedule-item__meta">${escapeHtml(`${formatTrainingAreaLabel(assignment.team.winterTrainingAreas)} · prefers ${assignment.team.winterTrainingPreference}`)}</div>
              ${canWrite ? `
                <div class="schedule-item__actions">
                  <button class="secondary-btn" type="button" data-edit-winter="${assignment.team.id}">Edit</button>
                  <button class="delete-btn" type="button" data-delete-winter="${assignment.team.id}">Remove</button>
                </div>
              ` : ""}
            </article>`).join("")
          : '<p class="empty-state">No teams allocated.</p>'}
      </div>
    </section>`;
}

function renderWinterTeamOptions(selectedTeamId = winterTeamSelect.value) {
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
  winterTeamSelect.disabled = false;
  for (const team of availableTeams) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = `${formatTeamDisplayName(team)} (${formatTrainingAreaLabel(team.winterTrainingAreas)} / prefers ${team.winterTrainingPreference})`;
    winterTeamSelect.appendChild(option);
  }
  if (state.teams.some((team) => team.id === selectedTeamId)) {
    winterTeamSelect.value = selectedTeamId;
  }
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
  return state.winterTrainingAssignments
    .filter((assignment) => assignment.day === day && assignment.time === time && assignment.teamId !== ignoreTeamId)
    .reduce((total, assignment) => {
      const team = state.teams.find((item) => item.id === assignment.teamId);
      return total + (team?.winterTrainingAreas || 0);
    }, 0);
}

function onSaveWinterAssignment(event) {
  event.preventDefault();
  if (!requireWriteAccess()) return;
  const formData = new FormData(winterAssignmentForm);
  const teamId = String(formData.get("teamId") || "");
  const day = String(formData.get("day") || "");
  const time = String(formData.get("time") || "");
  const issue = validateWinterAssignment(teamId, day, time, editState.winterTeamId || null);
  if (issue) return setTrainingMessage(issue, "error");

  const existingIndex = state.winterTrainingAssignments.findIndex((assignment) => assignment.teamId === teamId);
  const assignment = { teamId, day, time };
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

function validateWinterAssignment(teamId, day, time, ignoreTeamId = null) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return "Choose a valid team for winter training.";
  if (!WINTER_TRAINING_DAYS.includes(day)) return "Choose a valid weekday for winter training.";
  if (!WINTER_TRAINING_TIMES.includes(time)) return "Choose a valid winter training time.";
  const usedAreas = getWinterSlotAreasUsed(day, time, ignoreTeamId || teamId);
  if (usedAreas + team.winterTrainingAreas > 3) {
    return `That winter slot only has ${Math.max(0, 3 - usedAreas)} area${3 - usedAreas === 1 ? "" : "s"} left.`;
  }
  return null;
}

function startEditWinterAssignment(teamId) {
  const assignment = state.winterTrainingAssignments.find((item) => item.teamId === teamId);
  if (!assignment) return setTrainingMessage("That winter assignment could not be found.", "error");
  setActiveTab("training");
  editState.winterTeamId = teamId;
  winterTeamSelect.value = assignment.teamId;
  winterDaySelect.value = assignment.day;
  winterTimeSelect.value = assignment.time;
  syncEditorButtons();
}

function deleteWinterAssignment(teamId) {
  if (!requireWriteAccess()) return;
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
  if (WINTER_TRAINING_DAYS.includes("Monday")) winterDaySelect.value = "Monday";
  if (WINTER_TRAINING_TIMES.includes("18:00")) winterTimeSelect.value = "18:00";
  syncEditorButtons();
}

function autoFillWinterAssignments() {
  if (!requireWriteAccess()) return;
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
  if (!requireWriteAccess()) return;
  state.winterTrainingAssignments = [];
  resetWinterAssignmentForm();
  saveState();
  renderWinterTrainingPlanner();
  setTrainingMessage("Winter training plan cleared.", "ok");
}

function renderSummerTeamOptions(selectedTeamId = summerTeamSelect.value) {
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
  summerTeamSelect.disabled = false;
  for (const team of availableTeams) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = `${formatTeamDisplayName(team)} (${formatTrainingAreaLabel(team.winterTrainingAreas)} / prefers ${team.winterTrainingPreference})`;
    summerTeamSelect.appendChild(option);
  }
  if (state.teams.some((team) => team.id === selectedTeamId)) summerTeamSelect.value = selectedTeamId;
}

function renderSummerVenueOptions(selectedVenueId = summerVenueSelect.value) {
  summerVenueSelect.innerHTML = "";
  const enabledVenues = getSummerEnabledVenues();
  if (!enabledVenues.length) {
    summerVenueSelect.innerHTML = `<option value="">Set summer areas on a venue first</option>`;
    summerVenueSelect.disabled = true;
    return;
  }
  summerVenueSelect.disabled = false;
  for (const venue of enabledVenues) {
    const option = document.createElement("option");
    option.value = venue.id;
    option.textContent = `${venue.name} (${formatTrainingAreaLabel(venue.summerTrainingAreas)})`;
    summerVenueSelect.appendChild(option);
  }
  if (enabledVenues.some((venue) => venue.id === selectedVenueId)) summerVenueSelect.value = selectedVenueId;
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
        <p class="venue-panel__meta">Summer training uses whichever venues have summer areas configured in the Venues tab.</p>
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
                <div class="schedule-item__time">${escapeHtml(team.name)} (${escapeHtml(team.format)})</div>
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
  const areasUsed = assignments.reduce((total, assignment) => total + assignment.team.winterTrainingAreas, 0);
  const canWrite = canCurrentUserWrite();
  return `
    <section class="venue-panel training-slot-panel">
      <h4>${escapeHtml(day)}</h4>
      <p class="venue-panel__meta">${escapeHtml(`${time} · ${areasUsed} of ${venue.summerTrainingAreas} areas used`)}</p>
      <div class="schedule-list">
        ${assignments.length
          ? assignments.map((assignment) => `
            <article class="schedule-item">
              <div class="schedule-item__time">${escapeHtml(assignment.team.name)}</div>
              <div class="schedule-item__meta">${escapeHtml(`${formatTrainingAreaLabel(assignment.team.winterTrainingAreas)} · prefers ${assignment.team.winterTrainingPreference}`)}</div>
              ${canWrite ? `
                <div class="schedule-item__actions">
                  <button class="secondary-btn" type="button" data-edit-summer="${assignment.team.id}">Edit</button>
                  <button class="delete-btn" type="button" data-delete-summer="${assignment.team.id}">Remove</button>
                </div>
              ` : ""}
            </article>`).join("")
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
  if (!requireWriteAccess()) return;
  const formData = new FormData(summerTrainingForm);
  const teamId = String(formData.get("teamId") || "");
  const venueId = String(formData.get("venueId") || "");
  const day = String(formData.get("day") || "");
  const time = String(formData.get("time") || "");
  const issue = validateSummerTrainingAssignment(teamId, venueId, day, time, editState.summerTeamId || null);
  if (issue) return setTrainingMessage(issue, "error");

  const assignment = { teamId, venueId, day, time };
  const existingIndex = state.summerTrainingAssignments.findIndex((item) => item.teamId === teamId);
  if (existingIndex !== -1) {
    state.summerTrainingAssignments[existingIndex] = assignment;
  } else {
    state.summerTrainingAssignments.push(assignment);
  }

  saveState();
  renderSummerTrainingPlanner();
  resetSummerTrainingForm();
  setTrainingMessage("Summer training assignment saved.", "ok");
}

function validateSummerTrainingAssignment(teamId, venueId, day, time, ignoreTeamId = null) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return "Choose a valid team for summer training.";
  const venue = state.venues.find((item) => item.id === venueId);
  if (!venue || venue.summerTrainingAreas < 1) return "Choose a summer-enabled venue.";
  if (!WINTER_TRAINING_DAYS.includes(day)) return "Choose a valid weekday for summer training.";
  if (!WINTER_TRAINING_TIMES.includes(time)) return "Choose a valid summer training time.";
  const usedAreas = getSummerSlotAreasUsed(venueId, day, time, ignoreTeamId || teamId);
  if (usedAreas + team.winterTrainingAreas > venue.summerTrainingAreas) {
    return `That summer slot only has ${Math.max(0, venue.summerTrainingAreas - usedAreas)} area${venue.summerTrainingAreas - usedAreas === 1 ? "" : "s"} left.`;
  }
  return null;
}

function validateSummerVenueCapacity(venueId, areaCapacity) {
  if (areaCapacity < 0) return "Summer areas cannot be negative.";
  for (const day of WINTER_TRAINING_DAYS) {
    for (const time of WINTER_TRAINING_TIMES) {
      const usedAreas = state.summerTrainingAssignments
        .filter((assignment) => assignment.venueId === venueId && assignment.day === day && assignment.time === time)
        .reduce((total, assignment) => {
          const team = state.teams.find((item) => item.id === assignment.teamId);
          return total + (team?.winterTrainingAreas || 0);
        }, 0);
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
  return state.summerTrainingAssignments
    .filter(
      (assignment) =>
        assignment.venueId === venueId &&
        assignment.day === day &&
        assignment.time === time &&
        assignment.teamId !== ignoreTeamId
    )
    .reduce((total, assignment) => {
      const team = state.teams.find((item) => item.id === assignment.teamId);
      return total + (team?.winterTrainingAreas || 0);
    }, 0);
}

function startEditSummerTraining(teamId) {
  const assignment = state.summerTrainingAssignments.find((item) => item.teamId === teamId);
  if (!assignment) return setTrainingMessage("That summer assignment could not be found.", "error");
  setActiveTab("training");
  editState.summerTeamId = teamId;
  renderSummerTeamOptions(assignment.teamId);
  renderSummerVenueOptions(assignment.venueId);
  summerDaySelect.value = assignment.day;
  summerTimeSelect.value = assignment.time;
  syncEditorButtons();
}

function deleteSummerTraining(teamId) {
  if (!requireWriteAccess()) return;
  state.summerTrainingAssignments = state.summerTrainingAssignments.filter((assignment) => assignment.teamId !== teamId);
  if (editState.summerTeamId === teamId) resetSummerTrainingForm();
  saveState();
  renderSummerTrainingPlanner();
  setTrainingMessage("Summer training assignment removed.", "ok");
}

function resetSummerTrainingForm() {
  editState.summerTeamId = null;
  summerTrainingForm.reset();
  renderSummerTeamOptions();
  renderSummerVenueOptions();
  if (WINTER_TRAINING_DAYS.includes("Monday")) summerDaySelect.value = "Monday";
  if (WINTER_TRAINING_TIMES.includes("18:00")) summerTimeSelect.value = "18:00";
  syncEditorButtons();
}

function autoFillSummerAssignments() {
  if (!requireWriteAccess()) return;
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
  if (!requireWriteAccess()) return;
  state.summerTrainingAssignments = [];
  resetSummerTrainingForm();
  saveState();
  renderSummerTrainingPlanner();
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
  return `
    <div class="training-visual-cell">
      <div class="training-visual-capacity">${escapeHtml(`${areasUsed} of ${capacity} areas used`)}</div>
      ${assignments.length
        ? assignments.map((assignment) => `
          <div class="training-visual-team">
            <strong>${escapeHtml(assignment.team.name)}</strong>
            <small>${escapeHtml(`${formatTrainingAreaLabel(assignment.team.winterTrainingAreas)} · prefers ${assignment.team.winterTrainingPreference}`)}</small>
          </div>`).join("")
        : '<span class="empty-state">No teams allocated.</span>'}
    </div>`;
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
    if (minutes < 8 * 60 || minutes > 18 * 60) continue;
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
  setActiveTab("facilities");
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

function syncEditorButtons() {
  teamSubmitBtn.textContent = editState.teamId ? "Save Team Changes" : "Add Team";
  venueSubmitBtn.textContent = editState.venueId ? "Save Venue Changes" : "Add Venue";
  pitchSubmitBtn.textContent = editState.pitchId ? "Save Pitch Changes" : "Add Pitch";
  slotSubmitBtn.textContent = editState.slotId ? "Save Slot Changes" : "Add Slot";
  winterSubmitBtn.textContent = editState.winterTeamId ? "Save Winter Changes" : "Assign Winter Slot";
  summerSubmitBtn.textContent = editState.summerTeamId ? "Save Summer Changes" : "Assign Summer Slot";
  userSubmitBtn.textContent = editState.userId ? "Save User Changes" : "Add User";
  teamCancelBtn.hidden = !editState.teamId;
  venueCancelBtn.hidden = !editState.venueId;
  pitchCancelBtn.hidden = !editState.pitchId;
  slotCancelBtn.hidden = !editState.slotId;
  winterCancelBtn.hidden = !editState.winterTeamId;
  summerCancelBtn.hidden = !editState.summerTeamId;
  userCancelBtn.hidden = !editState.userId;
}
function deleteTeam(teamId) {
  if (!requireWriteAccess()) return;
  state.teams = state.teams.filter((team) => team.id !== teamId);
  state.lockedAssignments = state.lockedAssignments.filter((assignment) => assignment.teamId !== teamId);
  state.winterTrainingAssignments = state.winterTrainingAssignments.filter((assignment) => assignment.teamId !== teamId);
  state.summerTrainingAssignments = state.summerTrainingAssignments.filter((assignment) => assignment.teamId !== teamId);
  if (editState.teamId === teamId) resetTeamForm();
  if (editState.winterTeamId === teamId) resetWinterAssignmentForm();
  if (editState.summerTeamId === teamId) {
    resetSummerTrainingForm();
  }
  saveState();
  renderTeams();
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
  state.lockedAssignments = state.lockedAssignments.filter((assignment) => !deletedSlotIds.includes(assignment.slotId));
  state.summerTrainingAssignments = state.summerTrainingAssignments.filter((assignment) => assignment.venueId !== venueId);
  if (editState.venueId === venueId) resetVenueForm();
  if (editState.pitchId && deletedPitchIds.includes(editState.pitchId)) resetPitchForm();
  if (editState.slotId && !state.matchSlots.some((slot) => slot.id === editState.slotId)) resetSlotForm();
  if (editState.summerTeamId && !state.summerTrainingAssignments.some((assignment) => assignment.teamId === editState.summerTeamId)) {
    resetSummerTrainingForm();
  }
  saveState();
  renderVenues();
  renderPitchVenueOptions();
  renderPitches();
  renderSlotPitchOptions();
  renderMatchSlots();
  renderPlannerOutputs();
  renderSummerTrainingPlanner();
  setMessage("Venue deleted with its pitches, recurring match slots, and linked summer training assignments.", "ok");
}

function deletePitch(pitchId) {
  if (!requireWriteAccess()) return;
  const deletedSlotIds = state.matchSlots.filter((slot) => slot.pitchId === pitchId).map((slot) => slot.id);
  state.pitches = state.pitches.filter((pitch) => pitch.id !== pitchId);
  state.matchSlots = state.matchSlots.filter((slot) => slot.pitchId !== pitchId);
  state.lockedAssignments = state.lockedAssignments.filter((assignment) => !deletedSlotIds.includes(assignment.slotId));
  if (editState.pitchId === pitchId) resetPitchForm();
  if (editState.slotId && !state.matchSlots.some((slot) => slot.id === editState.slotId)) resetSlotForm();
  saveState();
  renderPitches();
  renderSlotPitchOptions();
  renderMatchSlots();
  renderPlannerOutputs();
  setMessage("Pitch deleted with its recurring match slots.", "ok");
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


