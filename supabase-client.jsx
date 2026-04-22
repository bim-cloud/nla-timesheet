// ── Supabase client ──────────────────────────────────────────
// Loaded before all other JSX files in index.html

const SUPABASE_URL  = 'https://tddegqxozgdnottitzeq.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_svk_tc3SIHy7e5yL2n3gYA_cH9yTvPg';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = sb;

// ── Profile helpers ───────────────────────────────────────────

const SupaProfiles = {
  // Upsert profile when user logs in
  async upsert(user) {
    const { error } = await sb.from('profiles').upsert({
      id:        user.id,
      username:  user.username,
      name:      user.name,
      role:      user.role,
      user_type: user.type,
      initials:  user.initials,
      tz:        user.tz        || 'Asia/Dubai',
      tz_label:  user.tzLabel   || 'UAE',
    }, { onConflict: 'id' });
    if (error) console.warn('Profile upsert error:', error.message);
  },

  async getAll() {
    const { data, error } = await sb.from('profiles').select('*').order('name');
    if (error) { console.warn('Profiles fetch error:', error.message); return []; }
    return data || [];
  },
};

// ── Entry helpers ─────────────────────────────────────────────

const SupaEntries = {
  // Load entries for a user on a given date (YYYY-MM-DD)
  async forDay(userId, date) {
    const { data, error } = await sb
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at');
    if (error) { console.warn('Entries fetch error:', error.message); return []; }
    return data || [];
  },

  // Load all entries for a date (manager view)
  async teamForDay(date) {
    const { data, error } = await sb
      .from('entries')
      .select('*, profiles(name, role, initials, user_type)')
      .eq('date', date)
      .order('created_at');
    if (error) { console.warn('Team entries fetch error:', error.message); return []; }
    return data || [];
  },

  // Load this week's entries for a user
  async forWeek(userId, mondayDate) {
    const friday = new Date(mondayDate);
    friday.setDate(friday.getDate() + 4);
    const { data, error } = await sb
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', mondayDate)
      .lte('date', friday.toISOString().split('T')[0])
      .order('date');
    if (error) { console.warn('Week entries fetch error:', error.message); return []; }
    return data || [];
  },

  // Insert a new entry
  async add(userId, entry) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await sb.from('entries').insert({
      user_id:      userId,
      date:         today,
      project_id:   entry.project,
      project_name: (window.DATA?.PROJECTS || []).find(p => p.id === entry.project)?.name || entry.project,
      task_type:    entry.type,
      title:        entry.title,
      notes:        entry.notes || '',
      hours:        entry.hours,
      status:       'draft',
    }).select().single();
    if (error) { console.warn('Entry insert error:', error.message); return null; }
    return data;
  },

  // Delete an entry
  async remove(entryId) {
    const { error } = await sb.from('entries').delete().eq('id', entryId);
    if (error) console.warn('Entry delete error:', error.message);
  },

  // Submit a day's entries (change status to 'submitted')
  async submitDay(userId, date) {
    const { error } = await sb
      .from('entries')
      .update({ status: 'submitted' })
      .eq('user_id', userId)
      .eq('date', date);
    if (error) console.warn('Submit error:', error.message);
  },


  // Load all entries for a week grouped by project+day (for weekly grid)
  async forWeekGrid(userId, mondayDate) {
    const friday = new Date(mondayDate);
    friday.setDate(friday.getDate() + 4);
    const { data, error } = await sb
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', mondayDate)
      .lte('date', friday.toISOString().split('T')[0])
      .order('created_at');
    if (error) { console.warn('Week grid fetch error:', error.message); return []; }
    return data || [];
  },

  // Upsert a grid cell — finds existing grid entry for project+date and updates, or inserts
  async upsertGridCell(userId, projectId, projectName, date, hours) {
    // Find existing grid entry for this project+date
    const { data: existing } = await sb
      .from('entries')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('project_id', projectId)
      .eq('task_type', 'grid')
      .maybeSingle();

    if (hours <= 0) {
      // Delete if exists
      if (existing?.id) {
        await sb.from('entries').delete().eq('id', existing.id);
      }
      return;
    }

    if (existing?.id) {
      // Update
      await sb.from('entries').update({ hours, title: `Weekly timesheet — ${projectName}` }).eq('id', existing.id);
    } else {
      // Insert
      await sb.from('entries').insert({
        user_id:      userId,
        date,
        project_id:   projectId,
        project_name: projectName,
        task_type:    'grid',
        title:        `Weekly timesheet — ${projectName}`,
        notes:        '',
        hours,
        status:       'draft',
      });
    }
  },

  // Submit all entries for a week + trigger email notification
  async submitWeek(userId, mondayDate, notifyPayload) {
    const friday = new Date(mondayDate);
    friday.setDate(friday.getDate() + 4);
    const { error } = await sb
      .from('entries')
      .update({ status: 'submitted' })
      .eq('user_id', userId)
      .gte('date', mondayDate)
      .lte('date', friday.toISOString().split('T')[0]);
    if (error) { console.warn('Submit week error:', error.message); return false; }

    // Fire email notification (non-blocking — don't fail submission if email fails)
    if (notifyPayload) {
      try {
        await sb.functions.invoke('notify-submission', { body: notifyPayload });
      } catch (e) {
        console.warn('Email notification failed (non-critical):', e.message);
      }
    }
    return true;
  },


  // Get all submitted (pending) timesheets for manager approval
  async getPendingSubmissions() {
    const { data, error } = await sb
      .from('entries')
      .select('*, profiles(name, role, initials)')
      .eq('status', 'submitted')
      .order('created_at', { ascending: false });
    if (error) { console.warn('Pending fetch error:', error.message); return []; }
    return data || [];
  },

  // Approve a list of entry IDs
  async approveSubmission(entryIds, employeeId, weekLabel) {
    const { error } = await sb
      .from('entries')
      .update({ status: 'approved' })
      .in('id', entryIds);
    if (error) { console.warn('Approve error:', error.message); return false; }
    // Notify employee
    if (employeeId) {
      await sb.from('notifications').insert({
        user_id: employeeId,
        type: 'approved',
        title: 'Timesheet approved',
        message: weekLabel ? `Your timesheet for ${weekLabel} has been approved.` : 'Your timesheet has been approved.',
      });
    }
    return true;
  },

  // Reject a list of entry IDs (set back to draft so employee can resubmit)
  async rejectSubmission(entryIds, employeeId, weekLabel) {
    const { error } = await sb
      .from('entries')
      .update({ status: 'draft' })
      .in('id', entryIds);
    if (error) { console.warn('Reject error:', error.message); return false; }
    // Notify employee
    if (employeeId) {
      await sb.from('notifications').insert({
        user_id: employeeId,
        type: 'rejected',
        title: 'Timesheet returned',
        message: weekLabel ? `Your timesheet for ${weekLabel} has been returned. Please review and resubmit.` : 'Your timesheet has been returned for revision.',
      });
    }
    return true;
  },

  // Manager: load all team entries + hours summary for a date range
  async teamSummary(fromDate, toDate) {
    const { data, error } = await sb
      .from('entries')
      .select('user_id, date, hours, project_id, status, profiles(name, initials, role)')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date');
    if (error) { console.warn('Team summary error:', error.message); return []; }
    return data || [];
  },
};

// ── Password helpers (stored in profiles.password column) ───
const SupaPasswords = {
  async update(userId, newPassword) {
    const { error } = await sb.from('profiles').update({ password: newPassword }).eq('id', userId);
    if (error) { console.warn('Password update error:', error.message); return false; }
    return true;
  },
  async verify(userId, password) {
    const { data, error } = await sb.from('profiles').select('password').eq('id', userId).single();
    if (error || !data) return false;
    return data.password === password;
  },
};

window.SupaProfiles  = SupaProfiles;
window.SupaEntries   = SupaEntries;
window.SupaPasswords = SupaPasswords;

// ── Notifications ──────────────────────────────────────────────
const SupaNotifications = {
  async getForUser(userId) {
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) { console.warn('Notifications fetch error:', error.message); return []; }
    return data || [];
  },
  async markRead(userId) {
    await sb.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  },
  async markOneRead(id) {
    await sb.from('notifications').update({ read: true }).eq('id', id);
  },
  async create(userId, type, title, message) {
    const { error } = await sb.from('notifications').insert({ user_id: userId, type, title, message });
    if (error) console.warn('Notification create error:', error.message);
  },
  async getUnreadCount(userId) {
    const { count, error } = await sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false);
    if (error) return 0;
    return count || 0;
  },
};

window.SupaNotifications = SupaNotifications;
