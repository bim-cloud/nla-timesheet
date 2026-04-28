// Sample data for Nature Landscape Architects

const PROJECTS = [
  { id: 'dch-f02', code: 'DCH-F02', name: 'Dubai Creek Harbor F02 Plot', client: 'Emaar', color: '#2f559b' },
  { id: 'dch-f09', code: 'DCH-F09', name: 'Dubai Creek Harbor F09 Plot', client: 'Emaar', color: '#3a7ca5' },
  { id: 'dch-f12', code: 'DCH-F12', name: 'Dubai Creek Harbor F12 Plot', client: 'Emaar', color: '#16697a' },
  { id: 'mip-2a', code: 'MIP-2A', name: 'Mid Island Parkway Phase 2A', client: 'Aldar', color: '#489c6c' },
  { id: 'mip-2c', code: 'MIP-2C', name: 'Mid Island Parkway Phase 2C', client: 'Aldar', color: '#5f7a3f' },
  { id: 'mip-2d', code: 'MIP-2D', name: 'Mid Island Parkway Phase 2D', client: 'Aldar', color: '#8a7a3f' },
];

const TASK_TYPES = [
  { id: 'design', label: 'Design / drafting', cls: 'design' },
  { id: 'meeting', label: 'Client meeting', cls: 'meeting' },
  { id: 'review', label: 'Review / QA', cls: 'review' },
];

const EMPLOYEES = [
  { id: 'afsal', name: 'Afsal Badrudeen', role: 'BIM Architect', initials: 'AB' },
  { id: 'sandra', name: 'Sandra', role: 'BIM Architect', initials: 'SA' },
  { id: 'rivin', name: 'Rivin Wilson', role: 'BIM Engineer', initials: 'RW' },
  { id: 'mehnas', name: 'Mehnas N Manzoor', role: 'BIM Engineer', initials: 'MM' },
  { id: 'elbin', name: 'Elbin Paulose', role: 'BIM Engineer', initials: 'EP' },
];

// Today's entries for the logged-in employee (Afsal)
const TODAY_ENTRIES = [
  {
    id: 'e1',
    project: 'dch-f09',
    type: 'design',
    title: 'LOD 300 hardscape modeling   north pavilion',
    notes: 'Completed paving layout, coordinated levels with civil team',
    hours: 3.5,
  },
  {
    id: 'e2',
    project: 'dch-f02',
    type: 'meeting',
    title: 'Client review   planting palette',
    notes: 'Emaar landscape lead + design team. Revisions logged.',
    hours: 1.0,
  },
  {
    id: 'e3',
    project: 'mip-2c',
    type: 'design',
    title: 'Irrigation family updates in Revit',
    notes: 'Updated parametric drip-line family to v2.1',
    hours: 2.25,
  },
];

// Week grid data for logged-in employee
const WEEK_DATA = [
  { project: 'dch-f09', hours: [3.5, 4.0, 6.5, 3.5, 0] },
  { project: 'dch-f02', hours: [2.0, 2.5, 0, 1.0, 0] },
  { project: 'mip-2c', hours: [2.5, 1.5, 1.5, 2.25, 0] },
  { project: 'mip-2a', hours: [0, 0, 0, 0, 0] },
];

// Manager view   team today
const TEAM_TODAY = [
  { emp: 'afsal', status: 'working', clockedIn: '08:42', hoursToday: 6.75, weekHours: 32.5, weekTarget: 40, currentProject: 'dch-f09' },
  { emp: 'sandra', status: 'working', clockedIn: '08:30', hoursToday: 7.0, weekHours: 35.0, weekTarget: 40, currentProject: 'dch-f02' },
  { emp: 'rivin', status: 'break', clockedIn: '09:05', hoursToday: 5.5, weekHours: 30.25, weekTarget: 40, currentProject: 'mip-2a' },
  { emp: 'mehnas', status: 'working', clockedIn: '08:55', hoursToday: 6.5, weekHours: 33.75, weekTarget: 40, currentProject: 'mip-2c' },
  { emp: 'elbin', status: 'leave', clockedIn: ' ', hoursToday: 0, weekHours: 24.0, weekTarget: 40, currentProject: null },
];

// Pending approvals
const APPROVALS = [
  { id: 'a1', type: 'timesheet', emp: 'sandra', label: 'Week of Apr 13   42.5 hrs', sub: 'Submitted Mon, Apr 20   2.5 hrs overtime' },
  { id: 'a2', type: 'leave', emp: 'rivin', label: 'Annual leave   Apr 27 to Apr 30', sub: '4 days   Submitted Fri, Apr 17' },
  { id: 'a3', type: 'timesheet', emp: 'elbin', label: 'Week of Apr 13   38 hrs', sub: 'Submitted Sun, Apr 19' },
];

// Project hour totals this week
const PROJECT_TOTALS = [
  { id: 'dch-f09', hours: 48.5, budget: 120, team: 3 },
  { id: 'dch-f02', hours: 32.0, budget: 80, team: 2 },
  { id: 'mip-2c', hours: 28.25, budget: 90, team: 2 },
  { id: 'dch-f12', hours: 18.5, budget: 60, team: 1 },
  { id: 'mip-2a', hours: 12.0, budget: 70, team: 1 },
  { id: 'mip-2d', hours: 6.5, budget: 50, team: 1 },
];

// Daily totals for week-at-a-glance bar chart (Mon-Fri)
const WEEK_DAILY_TOTALS = [38.5, 42.0, 40.5, 36.25, 18.0]; // Fri in progress

window.DATA = {
  PROJECTS, TASK_TYPES, EMPLOYEES, TODAY_ENTRIES, WEEK_DATA,
  TEAM_TODAY, APPROVALS, PROJECT_TOTALS, WEEK_DAILY_TOTALS,
};
