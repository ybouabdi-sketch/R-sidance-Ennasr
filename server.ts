import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('syndicnet.db');

// Initialize Database
db.exec(`

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    password TEXT,
    role TEXT,
    plan TEXT,
    property_type TEXT,
    residence_address TEXT,
    activation_date TEXT,
    expiration_date TEXT,
    price REAL,
    profile_picture TEXT,
    logo_url TEXT,
    is_active INTEGER DEFAULT 1,
    monthly_fee REAL DEFAULT 0,
    resident_monthly_fee REAL DEFAULT 0,
    shop_monthly_fee REAL DEFAULT 0,
    membership_fee REAL DEFAULT 0,
    shop_membership_fee REAL DEFAULT 0,
    currency TEXT DEFAULT 'DH',
    certified_year INTEGER,
    total_units INTEGER DEFAULT 0,
    receipt_settings TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS residents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    full_name TEXT,
    building TEXT,
    apartment TEXT,
    phone TEXT,
    email TEXT,
    password TEXT,
    pin TEXT,
    occupancy_type TEXT,
    status TEXT,
    is_active INTEGER DEFAULT 1,
    current_balance REAL DEFAULT 0,
    profile_picture TEXT,
    joining_date TEXT,
    property_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );
`);

try {
  db.exec("ALTER TABLE residents ADD COLUMN pin TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE residents ADD COLUMN joining_date TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE residents ADD COLUMN property_number TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE rental_incomes ADD COLUMN property_address TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE other_incomes ADD COLUMN property_address TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE other_incomes ADD COLUMN property_type TEXT");
} catch (error) {}

// Migrations for existing databases
try {
  db.exec("ALTER TABLE users ADD COLUMN total_units INTEGER DEFAULT 0");
} catch (error) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN receipt_settings TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN plan TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN property_type TEXT");
} catch (error) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN individual_payment REAL DEFAULT 0");
} catch (error) {}

try {
  db.exec("ALTER TABLE projects ADD COLUMN end_date DATETIME");
} catch (error) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    recipient_id INTEGER,
    title TEXT,
    message TEXT,
    type TEXT,
    is_read INTEGER DEFAULT 0,
    is_deleted_sender INTEGER DEFAULT 0,
    is_deleted_recipient INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    title TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resident_id INTEGER,
    syndic_id INTEGER,
    subject TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    answer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resident_id) REFERENCES residents(id),
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS automatic_reminders_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    resident_id INTEGER,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id),
    FOREIGN KEY(resident_id) REFERENCES residents(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    name TEXT,
    description TEXT,
    target_amount REAL,
    individual_payment REAL DEFAULT 0,
    status TEXT DEFAULT 'planned',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS project_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    resident_id INTEGER,
    syndic_id INTEGER,
    full_name TEXT,
    building TEXT,
    apartment TEXT,
    amount REAL,
    remaining_balance REAL,
    date TEXT,
    receipt_number TEXT,
    payment_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(resident_id) REFERENCES residents(id),
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );
`);

// Add resident_id column if it doesn't exist (migration)
try {
  db.prepare("ALTER TABLE project_payments ADD COLUMN resident_id INTEGER").run();
} catch (e) {}

// Add payment_type column if it doesn't exist (migration)
try {
  db.prepare("ALTER TABLE project_payments ADD COLUMN payment_type TEXT").run();
} catch (e) {}



// Migration for residents
const residentsInfo = db.prepare("PRAGMA table_info(residents)").all() as any[];
const residentsCols = residentsInfo.map(c => c.name);

if (!residentsCols.includes('id')) {
  try {
    db.exec(`
      ALTER TABLE residents RENAME TO residents_old;
      CREATE TABLE residents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        syndic_id INTEGER,
        full_name TEXT,
        building TEXT,
        apartment TEXT,
        phone TEXT,
        email TEXT,
        password TEXT,
        occupancy_type TEXT,
        status TEXT,
        is_active INTEGER DEFAULT 1,
        current_balance REAL DEFAULT 0,
        profile_picture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(syndic_id) REFERENCES users(id)
      );
      INSERT INTO residents (syndic_id, full_name, building, apartment, phone, email, password, occupancy_type, status, is_active, current_balance, profile_picture, created_at)
      SELECT syndic_id, full_name, building, apartment, phone, email, password, occupancy_type, status, is_active, current_balance, profile_picture, created_at FROM residents_old;
      DROP TABLE residents_old;
    `);
    console.log('Successfully added id column to residents table');
  } catch (err) {
    console.error('Error migrating residents table:', err);
  }
}

if (!residentsCols.includes('current_balance')) {
  db.exec("ALTER TABLE residents ADD COLUMN current_balance REAL DEFAULT 0");
}
if (!residentsCols.includes('profile_picture')) {
  db.exec("ALTER TABLE residents ADD COLUMN profile_picture TEXT");
}



// Migration for users
const usersInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
const usersCols = usersInfo.map(c => c.name);
if (!usersCols.includes('residence_address')) {
  db.exec("ALTER TABLE users ADD COLUMN residence_address TEXT");
}
if (!usersCols.includes('logo_url')) {
  db.exec("ALTER TABLE users ADD COLUMN logo_url TEXT");
}
if (!usersCols.includes('initial_bank_balance')) {
  db.exec("ALTER TABLE users ADD COLUMN initial_bank_balance REAL DEFAULT 0");
}
if (!usersCols.includes('initial_cashbox_balance')) {
  db.exec("ALTER TABLE users ADD COLUMN initial_cashbox_balance REAL DEFAULT 0");
}
if (!usersCols.includes('initial_uncollected_balance')) {
  db.exec("ALTER TABLE users ADD COLUMN initial_uncollected_balance REAL DEFAULT 0");
}
if (!usersCols.includes('initial_unpaid_balance')) {
  db.exec("ALTER TABLE users ADD COLUMN initial_unpaid_balance REAL DEFAULT 0");
}
if (!usersCols.includes('show_apartments')) {
  db.exec("ALTER TABLE users ADD COLUMN show_apartments INTEGER DEFAULT 1");
}
if (!usersCols.includes('show_villas')) {
  db.exec("ALTER TABLE users ADD COLUMN show_villas INTEGER DEFAULT 1");
}
if (!usersCols.includes('show_shops')) {
  db.exec("ALTER TABLE users ADD COLUMN show_shops INTEGER DEFAULT 1");
}
if (!usersCols.includes('stamp_signature')) {
  db.exec("ALTER TABLE users ADD COLUMN stamp_signature TEXT");
}
if (!usersCols.includes('residence_name')) {
  db.exec("ALTER TABLE users ADD COLUMN residence_name TEXT");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Clean legacy admin/landing tables and settings
try {
  db.exec("DROP TABLE IF EXISTS join_requests");
  db.exec("DROP TABLE IF EXISTS pricing_plans");
  db.prepare("DELETE FROM settings WHERE key IN ('pricing_offer', 'landing_page_config')").run();
} catch (e) {}

// Initialize login page config if not exists
const initSettings = () => {
  const loginConfig = db.prepare("SELECT * FROM settings WHERE key = 'login_page_config'").get() as any;
  if (!loginConfig) {
    const defaultLoginConfig = {
      appName: 'Résidance Ennasr',
      logoUrl: '',
      showLogo: true,
      showAppName: true,
      showFooter: false,
      global: {
        bgColor: '#F8FAFC',
        darkBgColor: '#020617',
        cardBgColor: '#FFFFFF',
        darkCardBgColor: '#0F172A',
        inputBgColor: '#F8FAFC',
        darkInputBgColor: '#1E293B',
        buttonBgColor: '#2563EB',
        buttonTextColor: '#FFFFFF',
        textColor: '#0F172A',
        darkTextColor: '#F8FAFC',
        fontFamily: 'Inter',
      },
      typography: {
        appNameSize: '30px',
        appNameWeight: 'bold',
        titleSize: '16px',
        titleWeight: 'normal',
        buttonSize: '18px',
        buttonWeight: 'bold',
      }
    };
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run('login_page_config', JSON.stringify(defaultLoginConfig));
  } else {
    try {
      const currentConfig = JSON.parse(loginConfig.value);
      if (currentConfig.appName === 'Syndicom' || currentConfig.appName === 'SandicNet' || currentConfig.appName === 'Syndicoom' || currentConfig.appName === 'Syndicos') {
        currentConfig.appName = 'Résidance Ennasr';
        db.prepare("UPDATE settings SET value = ? WHERE key = 'login_page_config'").run(JSON.stringify(currentConfig));
      }
    } catch (e) {
      console.error('Error migrating login_page_config:', e);
    }
  }
};
initSettings();

// Remove non-syndic accounts and seed default Syndic
const initDefaultSyndic = () => {
  try {
    db.prepare("DELETE FROM users WHERE role != 'syndic' OR role IS NULL").run();
  } catch (e) {}

  const syndic = db.prepare("SELECT * FROM users WHERE role = 'syndic' ORDER BY id ASC LIMIT 1").get();
  if (!syndic) {
    try {
      const now = new Date();
      db.prepare(`
        INSERT INTO users (
          full_name, email, phone, password, role, residence_name, residence_address,
          is_active, currency, certified_year, certified_month, total_units,
          initial_bank_balance, initial_cashbox_balance, initial_uncollected_balance, initial_unpaid_balance,
          show_apartments
        ) VALUES (?, ?, ?, ?, 'syndic', ?, ?, 1, 'DH', ?, ?, 0, 0, 0, 0, 0, 1)
      `).run(
        'Syndic',
        're.ennasr@gmail.com',
        '',
        '1111',
        '',
        '',
        now.getFullYear(),
        now.getMonth() + 1
      );
    } catch (e) {
      console.error('Error seeding default syndic:', e);
    }
  }
};
initDefaultSyndic();

try {
  db.exec("ALTER TABLE residents ADD COLUMN password TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE residents ADD COLUMN month INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE residents ADD COLUMN year INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE residents ADD COLUMN email TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE residents ADD COLUMN occupancy_type TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN monthly_fee REAL DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN currency TEXT DEFAULT 'DH'");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN resident_monthly_fee REAL DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN shop_monthly_fee REAL DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN membership_fee REAL DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN shop_membership_fee REAL DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN certified_year INTEGER DEFAULT " + new Date().getFullYear());
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN certified_month INTEGER DEFAULT " + (new Date().getMonth() + 1));
} catch (e) {}


try {
  db.exec("ALTER TABLE users ADD COLUMN villa_membership_fee REAL DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN villa_monthly_fee REAL DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE payments ADD COLUMN payment_type TEXT DEFAULT 'cash'");
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resident_id INTEGER,
    syndic_id INTEGER,
    amount REAL,
    remaining_balance REAL,
    month INTEGER,
    year INTEGER,
    date TEXT,
    receipt_number TEXT,
    months TEXT,
    payment_type TEXT DEFAULT 'cash',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(resident_id) REFERENCES residents(id),
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    expense_type TEXT,
    spender TEXT,
    amount REAL,
    receipt_number TEXT,
    month INTEGER,
    year INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rental_incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    property_type TEXT,
    tenant_name TEXT,
    phone TEXT,
    rental_price REAL,
    receipt_number TEXT,
    months_paid TEXT,
    months_unpaid TEXT,
    year INTEGER,
    date TEXT,
    status TEXT DEFAULT 'active',
    end_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rental_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rental_income_id INTEGER,
    syndic_id INTEGER,
    amount REAL,
    date TEXT,
    receipt_number TEXT,
    payment_type TEXT,
    months_covered TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(rental_income_id) REFERENCES rental_incomes(id),
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );
` + `
  CREATE TABLE IF NOT EXISTS other_incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    income_type TEXT,
    contributor_name TEXT,
    amount REAL,
    date TEXT,
    receipt_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bank_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    operation_type TEXT,
    amount REAL,
    name TEXT,
    date TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cashbox_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    syndic_id INTEGER,
    operation_type TEXT,
    amount REAL,
    name TEXT,
    date TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(syndic_id) REFERENCES users(id)
  );
`);

try {
  db.exec("ALTER TABLE payments ADD COLUMN date TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE payments ADD COLUMN month INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE payments ADD COLUMN year INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE payments ADD COLUMN months TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE rental_incomes ADD COLUMN total_paid REAL DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE rental_incomes ADD COLUMN status TEXT DEFAULT 'active'");
} catch (e) {}

try {
  db.exec("ALTER TABLE rental_incomes ADD COLUMN end_date TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE other_incomes ADD COLUMN notes TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE rental_payments ADD COLUMN bank_op_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE rental_payments ADD COLUMN cashbox_op_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE other_incomes ADD COLUMN bank_op_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE other_incomes ADD COLUMN cashbox_op_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE other_incomes ADD COLUMN payment_type TEXT DEFAULT 'cash'");
} catch (e) {}

try {
  db.exec("ALTER TABLE expenses ADD COLUMN payment_type TEXT DEFAULT 'cash'");
} catch (e) {}
try {
  db.exec("ALTER TABLE expenses ADD COLUMN bank_op_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE expenses ADD COLUMN cashbox_op_id INTEGER");
} catch (e) {}

try {
  db.exec("ALTER TABLE expenses ADD COLUMN notes TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE expenses ADD COLUMN date TEXT");
} catch (e) {}

// Migration for bank_operations
try {
  const bankInfo = db.prepare("PRAGMA table_info(bank_operations)").all() as any[];
  const bankCols = bankInfo.map(c => c.name);
  if (!bankCols.includes('name')) db.exec("ALTER TABLE bank_operations ADD COLUMN name TEXT");
  if (!bankCols.includes('date')) db.exec("ALTER TABLE bank_operations ADD COLUMN date TEXT");
  if (!bankCols.includes('description')) db.exec("ALTER TABLE bank_operations ADD COLUMN description TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE users ADD COLUMN reminder_message_template TEXT DEFAULT 'Bonjour {{name}}, nous vous rappelons que vous avez un solde impayé de {{amount}} DH. Merci de régulariser votre situation dans les plus brefs délais.'");
} catch (e) {}
try {
  db.prepare("UPDATE users SET reminder_message_template = ? WHERE reminder_message_template LIKE 'مرحبا {{name}}%'").run(
    'Bonjour {{name}}, nous vous rappelons que vous avez un solde impayé de {{amount}} DH. Merci de régulariser votre situation dans les plus brefs délais.'
  );
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN reminder_deadline_day INTEGER DEFAULT 5");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN reminder_days_between INTEGER DEFAULT 3");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN reminder_max_times INTEGER DEFAULT 3");
} catch (e) {}

try {
  db.exec("ALTER TABLE residents ADD COLUMN automatic_reminders_enabled INTEGER DEFAULT 0");
} catch (e) {}

async function startServer() {
  console.log('Starting server...');
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Routes
  app.get(['/api/notifications/unread-count', '/api/notifications/unread-count/:userId'], (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json({ count: 0 });
      }
      const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND is_read = 0').get(userId) as any;
      res.json({ count: count?.count || 0 });
    } catch (error: any) {
      res.status(400).json({ error: error.message, count: 0 });
    }
  });

  app.get('/api/settings/login-page', (req, res) => {
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'login_page_config'").get() as any;
      res.json(JSON.parse(row.value));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Syndic Routes
  app.get('/api/syndic/residents', (req, res) => {
    const { syndicId, type } = req.query;
    try {
      let query = 'SELECT * FROM residents WHERE syndic_id = ?';
      const params = [syndicId];
      if (type) {
        query += ' AND status = ?';
        params.push(type as string);
      }
      query += ' ORDER BY id DESC';
      const residents = db.prepare(query).all(...params);
      res.json(residents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/residents', (req, res) => {
    const { syndicId, fullName, building, apartment, phone, email, password, pin, occupancyType, status, currentBalance, propertyNumber, joiningDate } = req.body;
    try {
      if (email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        const existingResident = db.prepare('SELECT id FROM residents WHERE email = ?').get(email);
        if (existingResident) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      const stmt = db.prepare('INSERT INTO residents (syndic_id, full_name, building, apartment, phone, email, password, pin, occupancy_type, status, current_balance, property_number, joining_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const result = stmt.run(syndicId, fullName, building, apartment, phone, email, password, pin, occupancyType, status, currentBalance || 0, propertyNumber || '', joiningDate || '');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/residents/:id', (req, res) => {
    const { id } = req.params;
    const { fullName, building, apartment, phone, email, password, pin, occupancyType, status, is_active, currentBalance, propertyNumber, joiningDate } = req.body;
    try {
      if (email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        const existingResident = db.prepare('SELECT id FROM residents WHERE email = ? AND id != ?').get(email, Number(id));
        if (existingResident) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      let query = 'UPDATE residents SET full_name = ?, building = ?, apartment = ?, phone = ?, email = ?, occupancy_type = ?, status = ?, is_active = ?, current_balance = ?, property_number = ?, joining_date = ?';
      const params = [fullName, building, apartment, phone, email, occupancyType, status, is_active ? 1 : 0, currentBalance || 0, propertyNumber || '', joiningDate || ''];
      
      if (password) {
        query += ', password = ?';
        params.push(password);
      }
      
      query += ' WHERE id = ?';
      params.push(id);
      
      const stmt = db.prepare(query);
      stmt.run(...params);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/residents/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM residents WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/residents/all/:syndicId', (req, res) => {
    const syndicId = Number(req.params.syndicId);
    const { type } = req.query;
    if (isNaN(syndicId)) return res.status(400).json({ error: 'Invalid Syndic ID' });
    try {
      let query = 'DELETE FROM residents WHERE syndic_id = ?';
      const params: (string | number)[] = [syndicId];
      if (type) {
        query += ' AND status = ?';
        params.push(type as string);
      }
      db.prepare(query).run(...params);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Project Routes
  app.get('/api/syndic/projects', (req, res) => {
    const { syndicId } = req.query;
    try {
      const projects = db.prepare('SELECT * FROM projects WHERE syndic_id = ? ORDER BY id DESC').all(syndicId);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/projects', (req, res) => {
    const { syndicId, name, description, targetAmount, individualPayment, status, endDate } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO projects (syndic_id, name, description, target_amount, individual_payment, status, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const result = stmt.run(syndicId, name, description, targetAmount, individualPayment || 0, status || 'planned', endDate || null);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/projects/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, targetAmount, individualPayment, status, endDate } = req.body;
    try {
      const stmt = db.prepare('UPDATE projects SET name = ?, description = ?, target_amount = ?, individual_payment = ?, status = ?, end_date = ? WHERE id = ?');
      stmt.run(name, description, targetAmount, individualPayment || 0, status, endDate || null, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/projects/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM project_payments WHERE project_id = ?').run(req.params.id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/projects/all/:syndicId', (req, res) => {
    const { syndicId } = req.params;
    try {
      db.prepare('DELETE FROM project_payments WHERE syndic_id = ?').run(syndicId);
      db.prepare('DELETE FROM projects WHERE syndic_id = ?').run(syndicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Project Payment Routes
  app.get('/api/syndic/project-payments', (req, res) => {
    const { syndicId } = req.query;
    try {
      const payments = db.prepare(`
        SELECT pp.*, p.name as project_name, p.description as project_description 
        FROM project_payments pp
        JOIN projects p ON pp.project_id = p.id
        WHERE pp.syndic_id = ? 
        ORDER BY pp.id DESC
      `).all(syndicId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/project-payments', (req, res) => {
    const { projectId, residentId, syndicId, fullName, building, apartment, amount, remainingBalance, date, receiptNumber, paymentType } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO project_payments (project_id, resident_id, syndic_id, full_name, building, apartment, amount, remaining_balance, date, receipt_number, payment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const result = stmt.run(projectId, residentId, syndicId, fullName, building, apartment, amount, remainingBalance, date, receiptNumber, paymentType);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/project-payments/:id', (req, res) => {
    const { id } = req.params;
    const { residentId, fullName, building, apartment, amount, remainingBalance, date, receiptNumber, paymentType } = req.body;
    try {
      const stmt = db.prepare('UPDATE project_payments SET resident_id = ?, full_name = ?, building = ?, apartment = ?, amount = ?, remaining_balance = ?, date = ?, receipt_number = ?, payment_type = ? WHERE id = ?');
      stmt.run(residentId, fullName, building, apartment, amount, remainingBalance, date, receiptNumber, paymentType, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/project-payments/all/:projectId', (req, res) => {
    const { projectId } = req.params;
    try {
      db.prepare('DELETE FROM project_payments WHERE project_id = ?').run(projectId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/project-payments/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM project_payments WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/syndic/units-count/:syndicId', (req, res) => {
    try {
      const { syndicId } = req.params;
      const count = db.prepare('SELECT COUNT(*) as count FROM residents WHERE syndic_id = ?').get(syndicId) as any;
      res.json({ count: count.count });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/syndic/dashboard-stats/:syndicId', (req, res) => {
    const syndicId = Number(req.params.syndicId);
    if (isNaN(syndicId)) return res.status(400).json({ error: 'Invalid Syndic ID' });

    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;

    try {
      // Basic counts
      const counts = db.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'resident' THEN 1 END) as residents_count
        FROM residents WHERE syndic_id = ?
      `).get(syndicId) as any;

      // Financial totals
      const profile = db.prepare('SELECT membership_fee, certified_year, certified_month FROM users WHERE id = ?').get(syndicId) as any;
      const certYear = profile?.certified_year || new Date().getFullYear();
      const certMonth = profile?.certified_month || 1;

      const residents = db.prepare("SELECT id, status, current_balance FROM residents WHERE syndic_id = ? AND status = 'resident'").all(syndicId) as any[];
      const residentTotals = db.prepare('SELECT resident_id, SUM(amount) as total_paid FROM payments WHERE syndic_id = ? GROUP BY resident_id').all(syndicId) as any[];
      
      let calculatedPaymentsTotal = 0;
      let apartmentPayers = 0;
      let payersCountValue = 0;
      
      const targetYear = year || new Date().getFullYear();
      const monthsToCheck = month ? [month] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      
      residents.forEach(resident => {
        const monthlyFee = profile?.membership_fee || 0;
        
        if (monthlyFee > 0) {
          const paymentsPaid = residentTotals.find(rt => rt.resident_id === resident.id)?.total_paid || 0;
          const initialBalance = Number(resident.current_balance || 0);
          const effectiveInitialBalance = initialBalance > 0 ? initialBalance : 0;
          const totalPaid = effectiveInitialBalance + paymentsPaid;
          const monthsCovered = Math.floor(totalPaid / monthlyFee);
          
          let isPayerForAnyMonth = false;
          monthsToCheck.forEach(m => {
            const monthIndexFromStart = (targetYear - certYear) * 12 + (m - certMonth);
            if (monthIndexFromStart >= 0 && monthIndexFromStart < monthsCovered) {
              calculatedPaymentsTotal += monthlyFee;
              isPayerForAnyMonth = true;
            }
          });
          if (isPayerForAnyMonth) {
            payersCountValue++;
            apartmentPayers++;
          }
        }
      });

      const rentals = db.prepare('SELECT id, rental_price, total_paid, date, end_date, tenant_name, property_type FROM rental_incomes WHERE syndic_id = ?').all(syndicId) as any[];
      let calculatedRentalTotal = 0;
      let overdueAmount = 0;
      
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Raw breakdown for residents
      const breakdown = db.prepare(`
        SELECT 
          SUM(CASE WHEN r.status = 'resident' THEN p.amount ELSE 0 END) as apartment_income
        FROM payments p
        JOIN residents r ON p.resident_id = r.id
        WHERE p.syndic_id = ?
        ${year ? 'AND p.year = ?' : ''}
        ${month ? 'AND p.month = ?' : ''}
      `).get(syndicId, ...(year ? [year] : []), ...(month ? [month] : [])) as any;

      const apartmentIncome = breakdown.apartment_income || 0;

      // 1. Residents overdue
      residents.forEach(resident => {
        const monthlyFee = profile?.membership_fee || 0;
        
        const totalPaid = Number(resident.current_balance || 0) + (residentTotals.find(rt => rt.resident_id === resident.id)?.total_paid || 0);
        
        let totalMonthsUntilCurrent = 0;
        if (currentYear > certYear) {
          totalMonthsUntilCurrent = (currentYear - certYear) * 12 + (currentMonth - certMonth + 1);
        } else if (currentYear === certYear) {
          totalMonthsUntilCurrent = Math.max(0, currentMonth - certMonth + 1);
        }

        const totalRequired = totalMonthsUntilCurrent * monthlyFee;
        const balance = totalPaid - totalRequired;

        if (balance < 0) {
          overdueAmount += Math.abs(balance);
        }
      });

      // 2. Rental Incomes overdue
      const tenantMap = new Map<string, any[]>();
      rentals.forEach(rental => {
        const key = `${rental.tenant_name || ''}-${rental.property_type || ''}`;
        if (!tenantMap.has(key)) tenantMap.set(key, []);
        tenantMap.get(key)!.push(rental);
      });

      tenantMap.forEach(records => {
        const earliestRecord = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
        const cumulativeTotalPaid = records.reduce((sum, r) => sum + (r.total_paid || 0), 0);
        const rentalPrice = Number(earliestRecord.rental_price || 0);
        
        if (rentalPrice > 0 && earliestRecord.date) {
          const startDate = new Date(earliestRecord.date);
          const startMonth = startDate.getMonth() + 1;
          const startYear = startDate.getFullYear();
          
          let referenceYear = currentYear;
          let referenceMonth = currentMonth;

          const endedRecord = records.find(r => r.end_date);
          if (endedRecord) {
            const endDate = new Date(endedRecord.end_date);
            const endM = endDate.getMonth() + 1;
            const endY = endDate.getFullYear();
            
            if (endY < currentYear || (endY === currentYear && endM < currentMonth)) {
              referenceYear = endY;
              referenceMonth = endM;
            }
          }

          const totalMonthsRequired = Math.max(0, (referenceYear - startYear) * 12 + (referenceMonth - startMonth) + 1);
          const totalAmountRequired = totalMonthsRequired * rentalPrice;
          
          const balance = cumulativeTotalPaid - totalAmountRequired;
          
          if (balance < 0) {
            overdueAmount += Math.abs(balance);
          }
        }
      });
      
      rentals.forEach(rental => {
        const rentalPrice = rental.rental_price || 0;
        const totalPaid = rental.total_paid || 0;
        
        if (rentalPrice > 0 && rental.date) {
          const startDate = new Date(rental.date);
          const startYear = startDate.getFullYear();
          const startMonth = startDate.getMonth() + 1;
          const monthsCovered = Math.floor(totalPaid / rentalPrice);
          
          monthsToCheck.forEach(m => {
            const monthsSinceStart = (targetYear - startYear) * 12 + (m - startMonth);
            
            if (monthsSinceStart >= 0) {
              let isEnded = false;
              if (rental.end_date) {
                const endDate = new Date(rental.end_date);
                const endMonth = endDate.getMonth() + 1;
                const endYear = endDate.getFullYear();
                if (targetYear > endYear || (targetYear === endYear && m > endMonth)) {
                  isEnded = true;
                }
              }
              
              if (!isEnded && monthsSinceStart < monthsCovered) {
                calculatedRentalTotal += rentalPrice;
              }
            }
          });
        }
      });

      let otherQuery = 'SELECT IFNULL(SUM(amount), 0) as total FROM other_incomes WHERE syndic_id = ?';
      const otherParams: any[] = [syndicId];
      if (year) { otherQuery += " AND strftime('%Y', date) = ?"; otherParams.push(`${year}`); }
      if (month) { otherQuery += " AND strftime('%m', date) = ?"; otherParams.push(month < 10 ? `0${month}` : `${month}`); }
      const otherTotal = db.prepare(otherQuery).get(...otherParams) as any;

      let projectQuery = 'SELECT IFNULL(SUM(amount), 0) as total FROM project_payments WHERE syndic_id = ?';
      const projectParams: any[] = [syndicId];
      if (year) { projectQuery += " AND strftime('%Y', date) = ?"; projectParams.push(`${year}`); }
      if (month) { projectQuery += " AND strftime('%m', date) = ?"; projectParams.push(month < 10 ? `0${month}` : `${month}`); }
      const projectTotal = db.prepare(projectQuery).get(...projectParams) as any;

      let expensesQuery = 'SELECT IFNULL(SUM(amount), 0) as total FROM expenses WHERE syndic_id = ?';
      const expensesParams: any[] = [syndicId];
      if (year) { expensesQuery += " AND strftime('%Y', date) = ?"; expensesParams.push(`${year}`); }
      if (month) { expensesQuery += " AND strftime('%m', date) = ?"; expensesParams.push(month < 10 ? `0${month}` : `${month}`); }
      const expenseTotal = db.prepare(expensesQuery).get(...expensesParams) as any;

      // Raw payments for residents
      let rawPaymentsQuery = 'SELECT IFNULL(SUM(amount), 0) as total FROM payments WHERE syndic_id = ?';
      const rawPaymentsParams: any[] = [syndicId];
      if (year) { rawPaymentsQuery += " AND strftime('%Y', date) = ?"; rawPaymentsParams.push(`${year}`); }
      if (month) { rawPaymentsQuery += " AND strftime('%m', date) = ?"; rawPaymentsParams.push(month < 10 ? `0${month}` : `${month}`); }
      const rawPaymentsTotal = db.prepare(rawPaymentsQuery).get(...rawPaymentsParams) as any;

      // Raw payments for rentals
      let rawRentalPaymentsQuery = 'SELECT IFNULL(SUM(amount), 0) as total FROM rental_payments WHERE syndic_id = ?';
      const rawRentalPaymentsParams: any[] = [syndicId];
      if (year) { rawRentalPaymentsQuery += " AND strftime('%Y', date) = ?"; rawRentalPaymentsParams.push(`${year}`); }
      if (month) { rawRentalPaymentsQuery += " AND strftime('%m', date) = ?"; rawRentalPaymentsParams.push(month < 10 ? `0${month}` : `${month}`); }
      const rawRentalPaymentsTotal = db.prepare(rawRentalPaymentsQuery).get(...rawRentalPaymentsParams) as any;

      // Monthly data (last 12 months or selected year)
      const last12Months = [];
      if (year && !month) {
        for (let i = 12; i >= 1; i--) {
          last12Months.push({ month: i, year: year });
        }
      } else {
        const currentDate = new Date();
        let currentM = month || currentDate.getMonth() + 1;
        let currentY = year || currentDate.getFullYear();
        
        for (let i = 0; i < 12; i++) {
          last12Months.push({ month: currentM, year: currentY });
          currentM--;
          if (currentM === 0) {
            currentM = 12;
            currentY--;
          }
        }
      }

      const monthlyIncome = last12Months.map(m => {
        const paymentsForMonth = db.prepare(`
          SELECT IFNULL(SUM(amount), 0) as total 
          FROM payments 
          WHERE syndic_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        `).get(syndicId, `${m.year}`, m.month < 10 ? `0${m.month}` : `${m.month}`) as any;

        const rentalForMonth = db.prepare(`
          SELECT IFNULL(SUM(amount), 0) as total 
          FROM rental_payments 
          WHERE syndic_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        `).get(syndicId, `${m.year}`, m.month < 10 ? `0${m.month}` : `${m.month}`) as any;

        const otherForMonth = db.prepare(`
          SELECT IFNULL(SUM(amount), 0) as total 
          FROM other_incomes 
          WHERE syndic_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        `).get(syndicId, `${m.year}`, m.month < 10 ? `0${m.month}` : `${m.month}`) as any;

        const projectForMonth = db.prepare(`
          SELECT IFNULL(SUM(amount), 0) as total 
          FROM project_payments 
          WHERE syndic_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        `).get(syndicId, `${m.year}`, m.month < 10 ? `0${m.month}` : `${m.month}`) as any;
        
        const total = paymentsForMonth.total + rentalForMonth.total + otherForMonth.total + projectForMonth.total;

        return { month: m.month, year: m.year, total };
      });

      const monthlyExpenses = last12Months.map(m => {
        const expenseForMonth = db.prepare(`
          SELECT IFNULL(SUM(amount), 0) as total 
          FROM expenses 
          WHERE syndic_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?
        `).get(syndicId, `${m.year}`, m.month < 10 ? `0${m.month}` : `${m.month}`) as any;
        
        return { month: m.month, year: m.year, total: expenseForMonth.total };
      });

      const totalResidents = counts.residents_count || 0;

      // Bank and Cashbox balances
      const user = db.prepare('SELECT initial_bank_balance, initial_cashbox_balance FROM users WHERE id = ?').get(syndicId) as any;
      const initialBank = user?.initial_bank_balance || 0;
      const initialCashbox = user?.initial_cashbox_balance || 0;

      const bankOps = db.prepare('SELECT operation_type, amount FROM bank_operations WHERE syndic_id = ?').all(syndicId) as any[];
      const bankOpsTotal = bankOps.reduce((acc, curr) => acc + (curr.operation_type === 'deposit' ? curr.amount : -curr.amount), 0);
      
      const cashboxOps = db.prepare('SELECT operation_type, amount FROM cashbox_operations WHERE syndic_id = ?').all(syndicId) as any[];
      const cashboxOpsTotal = cashboxOps.reduce((acc, curr) => acc + (curr.operation_type === 'deposit' ? curr.amount : -curr.amount), 0);

      const payments = db.prepare('SELECT amount, payment_type FROM payments WHERE syndic_id = ?').all(syndicId) as any[];
      const bankPayments = payments.filter(c => c.payment_type === 'bank').reduce((acc, curr) => acc + curr.amount, 0);
      const cashPayments = (payments.filter(c => c.payment_type === 'cash') as any[]).reduce((acc, curr) => acc + curr.amount, 0);

      const projectPayments = db.prepare('SELECT amount, payment_type FROM project_payments WHERE syndic_id = ?').all(syndicId) as any[];
      const bankProjectPayments = projectPayments.filter(c => c.payment_type === 'bank').reduce((acc, curr) => acc + curr.amount, 0);
      const cashProjectPayments = projectPayments.filter(c => c.payment_type === 'cash').reduce((acc, curr) => acc + curr.amount, 0);

      const bankBalance = bankOpsTotal + bankPayments + bankProjectPayments + initialBank;
      const cashboxBalance = cashboxOpsTotal + cashPayments + cashProjectPayments + initialCashbox;

      res.json({
        counts,
        totals: {
          income: (rawPaymentsTotal.total || 0) + (rawRentalPaymentsTotal.total || 0) + (otherTotal.total || 0) + (projectTotal.total || 0),
          expenses: expenseTotal.total || 0,
          payments: rawPaymentsTotal.total || 0,
          apartmentIncome,
          rental: rawRentalPaymentsTotal.total || 0,
          other: otherTotal.total || 0,
          project: projectTotal.total || 0,
          bankBalance,
          cashboxBalance,
          overdueAmount
        },
        monthly: {
          income: monthlyIncome,
          expenses: monthlyExpenses
        },
        payerStatus: {
          payers: payersCountValue,
          nonPayers: Math.max(0, totalResidents - payersCountValue),
          apartments: {
            payers: apartmentPayers,
            nonPayers: Math.max(0, (counts.residents_count || 0) - apartmentPayers)
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Payments
  app.get('/api/syndic/payments', (req, res) => {
    const { syndicId, type } = req.query;
    try {
      let query = `
        SELECT c.*, r.full_name, r.building, r.apartment, r.current_balance, r.status as property_type,
        (r.current_balance + (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE resident_id = c.resident_id)) as total_paid
        FROM payments c 
        JOIN residents r ON c.resident_id = r.id 
        WHERE c.syndic_id = ?
      `;
      const params: any[] = [syndicId];
      if (type) { query += ' AND r.status = ?'; params.push(type); }
      query += ' ORDER BY c.id DESC';
      
      const payments = db.prepare(query).all(...params);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/payments', (req, res) => {
    let { residentId, syndicId, amount, remainingBalance, date, receiptNumber, month, year, months, paymentType } = req.body;
    try {
      if (!receiptNumber) {
        const maxReceipt = db.prepare('SELECT MAX(CAST(receipt_number AS INTEGER)) as max_rn FROM payments WHERE syndic_id = ?').get(syndicId) as any;
        receiptNumber = (maxReceipt?.max_rn || 0) + 1;
      }
      const stmt = db.prepare('INSERT INTO payments (resident_id, syndic_id, amount, remaining_balance, date, receipt_number, month, year, months, payment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      stmt.run(residentId, syndicId, amount, remainingBalance || null, date, String(receiptNumber), month || null, year || null, months || null, paymentType || 'cash');
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/payments/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/payments/all/:syndicId', (req, res) => {
    try {
      db.prepare('DELETE FROM payments WHERE syndic_id = ?').run(req.params.syndicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/payments/:id', (req, res) => {
    const { id } = req.params;
    const { residentId, amount, date, receiptNumber, month, year, months, paymentType } = req.body;
    try {
      const stmt = db.prepare('UPDATE payments SET resident_id = ?, amount = ?, date = ?, receipt_number = ?, month = ?, year = ?, months = ?, payment_type = ? WHERE id = ?');
      stmt.run(residentId, amount, date, receiptNumber, month || null, year || null, months || null, paymentType || 'cash', id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Expenses
  app.get('/api/syndic/expenses', (req, res) => {
    const { syndicId } = req.query;
    try {
      let query = 'SELECT * FROM expenses WHERE syndic_id = ? ORDER BY id DESC';
      const params: any[] = [syndicId];
      const expenses = db.prepare(query).all(...params);
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/expenses', (req, res) => {
    const { syndicId, expenseType, spender, amount, receiptNumber, notes, date, paymentType } = req.body;
    const transaction = db.transaction(() => {
      let receiptNum = receiptNumber;
      if (!receiptNum) {
        const maxReceipt = db.prepare('SELECT MAX(CAST(receipt_number AS INTEGER)) as max_rn FROM expenses WHERE syndic_id = ?').get(syndicId) as any;
        receiptNum = (maxReceipt?.max_rn || 0) + 1;
      }

      // Record in bank or cashbox
      let bankOpId = null;
      let cashboxOpId = null;
      const description = `RECEIPT|${receiptNum}`;
      const name = `EXPENSE|${expenseType}|${spender}`;

      if (paymentType === 'bank') {
        const result = db.prepare('INSERT INTO bank_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(syndicId, 'withdrawal', amount, name, date, description);
        bankOpId = result.lastInsertRowid;
      } else {
        const result = db.prepare('INSERT INTO cashbox_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(syndicId, 'withdrawal', amount, name, date, description);
        cashboxOpId = result.lastInsertRowid;
      }

      const stmt = db.prepare('INSERT INTO expenses (syndic_id, expense_type, spender, amount, receipt_number, notes, date, payment_type, bank_op_id, cashbox_op_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      stmt.run(syndicId, expenseType, spender, amount, String(receiptNum), notes, date, paymentType, bankOpId, cashboxOpId);
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/expenses/:id', (req, res) => {
    const { id } = req.params;
    const transaction = db.transaction(() => {
      const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any;
      if (!expense) throw new Error('Expense not found');

      // Delete from bank or cashbox
      if (expense.bank_op_id) {
        db.prepare('DELETE FROM bank_operations WHERE id = ?').run(expense.bank_op_id);
      }
      if (expense.cashbox_op_id) {
        db.prepare('DELETE FROM cashbox_operations WHERE id = ?').run(expense.cashbox_op_id);
      }

      db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/expenses/all/:syndicId', (req, res) => {
    try {
      db.prepare('DELETE FROM expenses WHERE syndic_id = ?').run(req.params.syndicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/expenses/:id', (req, res) => {
    const { id } = req.params;
    const { expenseType, spender, amount, receiptNumber, notes, date, paymentType } = req.body;
    try {
      const stmt = db.prepare('UPDATE expenses SET expense_type = ?, spender = ?, amount = ?, receipt_number = ?, notes = ?, date = ?, payment_type = ? WHERE id = ?');
      stmt.run(expenseType, spender, amount, receiptNumber, notes, date, paymentType, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Bank Operations
  app.get('/api/syndic/bank', (req, res) => {
    const { syndicId } = req.query;
    try {
      const ops = db.prepare(`
        SELECT b.*, 
          (EXISTS(SELECT 1 FROM expenses e WHERE e.bank_op_id = b.id) OR 
           EXISTS(SELECT 1 FROM other_incomes oi WHERE oi.bank_op_id = b.id) OR 
           EXISTS(SELECT 1 FROM rental_payments rp WHERE rp.bank_op_id = b.id)) as is_linked
        FROM bank_operations b 
        WHERE b.syndic_id = ?
        ORDER BY b.id DESC
      `).all(syndicId);
      res.json(ops);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/bank', (req, res) => {
    const { syndicId, operationType, amount, name, date, description } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO bank_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)');
      stmt.run(syndicId, operationType, amount, name, date, description);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/bank/:id', (req, res) => {
    const { id } = req.params;
    const { operation_type, amount, name, date, description } = req.body;
    try {
      const isLinked = db.prepare(`
        SELECT (EXISTS(SELECT 1 FROM expenses WHERE bank_op_id = ?) OR 
                EXISTS(SELECT 1 FROM other_incomes WHERE bank_op_id = ?) OR 
                EXISTS(SELECT 1 FROM rental_payments WHERE bank_op_id = ?)) as is_linked
      `).get(id, id, id) as any;

      if (isLinked.is_linked) {
        return res.status(400).json({ error: 'Cannot edit linked operation' });
      }

      db.prepare('UPDATE bank_operations SET operation_type = ?, amount = ?, name = ?, date = ?, description = ? WHERE id = ?').run(operation_type, amount, name, date, description, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/bank/:id', (req, res) => {
    const { id } = req.params;
    try {
      const isLinked = db.prepare(`
        SELECT (EXISTS(SELECT 1 FROM expenses WHERE bank_op_id = ?) OR 
                EXISTS(SELECT 1 FROM other_incomes WHERE bank_op_id = ?) OR 
                EXISTS(SELECT 1 FROM rental_payments WHERE bank_op_id = ?)) as is_linked
      `).get(id, id, id) as any;

      if (isLinked.is_linked) {
        return res.status(400).json({ error: 'Cannot delete linked operation' });
      }

      db.prepare('DELETE FROM bank_operations WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/syndic/cashbox', (req, res) => {
    const { syndicId } = req.query;
    try {
      const ops = db.prepare(`
        SELECT c.*, 
          (EXISTS(SELECT 1 FROM expenses e WHERE e.cashbox_op_id = c.id) OR 
           EXISTS(SELECT 1 FROM other_incomes oi WHERE oi.cashbox_op_id = c.id) OR 
           EXISTS(SELECT 1 FROM rental_payments rp WHERE rp.cashbox_op_id = c.id)) as is_linked
        FROM cashbox_operations c 
        WHERE c.syndic_id = ?
        ORDER BY date DESC
      `).all(syndicId);
      res.json(ops);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/cashbox', (req, res) => {
    const { syndicId, operationType, amount, name, date, description } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO cashbox_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)');
      stmt.run(syndicId, operationType, amount, name, date, description);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/syndic/cashbox/:id', (req, res) => {
    const { id } = req.params;
    const { operationType, amount, name, date, description } = req.body;
    try {
      const isLinked = db.prepare(`
        SELECT (EXISTS(SELECT 1 FROM expenses WHERE cashbox_op_id = ?) OR 
                EXISTS(SELECT 1 FROM other_incomes WHERE cashbox_op_id = ?) OR 
                EXISTS(SELECT 1 FROM rental_payments WHERE cashbox_op_id = ?)) as is_linked
      `).get(id, id, id) as any;

      if (isLinked.is_linked) {
        return res.status(400).json({ error: 'Cannot edit linked operation' });
      }

      db.prepare('UPDATE cashbox_operations SET operation_type = ?, amount = ?, name = ?, date = ?, description = ? WHERE id = ?').run(operationType, amount, name, date, description, id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/cashbox/:id', (req, res) => {
    const { id } = req.params;
    try {
      const isLinked = db.prepare(`
        SELECT (EXISTS(SELECT 1 FROM expenses WHERE cashbox_op_id = ?) OR 
                EXISTS(SELECT 1 FROM other_incomes WHERE cashbox_op_id = ?) OR 
                EXISTS(SELECT 1 FROM rental_payments WHERE cashbox_op_id = ?)) as is_linked
      `).get(id, id, id) as any;

      if (isLinked.is_linked) {
        return res.status(400).json({ error: 'Cannot delete linked operation' });
      }

      db.prepare('DELETE FROM cashbox_operations WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rental Incomes
  app.get('/api/syndic/rental-payments/history', (req, res) => {
    const { tenant_name, property_type, syndic_id, year, month } = req.query;
    try {
      let query = `
        SELECT rp.* 
        FROM rental_payments rp
        JOIN rental_incomes ri ON rp.rental_income_id = ri.id
        WHERE ri.tenant_name = ? AND ri.property_type = ? AND ri.syndic_id = ?
      `;
      const params: any[] = [tenant_name, property_type, Number(syndic_id)];

      if (year && year !== 'all') {
        query += ' AND rp.date LIKE ?';
        params.push(`${year}-%`);
      }
      if (month && month !== 'all') {
        query += ' AND CAST(strftime("%m", rp.date) AS INTEGER) = ?';
        params.push(Number(month));
      }

      query += ' ORDER BY rp.date DESC';
      const payments = db.prepare(query).all(...params);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/syndic/rental-payments/:rentalIncomeId', (req, res) => {
    const { rentalIncomeId } = req.params;
    const { year, month } = req.query;
    try {
      let query = 'SELECT * FROM rental_payments WHERE rental_income_id = ?';
      const params: any[] = [rentalIncomeId];

      if (year && year !== 'all') {
        query += ' AND strftime("%Y", date) = ?';
        params.push(year);
      }
      if (month && month !== 'all') {
        query += ' AND CAST(strftime("%m", date) AS INTEGER) = ?';
        params.push(Number(month));
      }

      query += ' ORDER BY date DESC';
      const payments = db.prepare(query).all(...params);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/rental-payments', (req, res) => {
    const { rentalIncomeId, syndicId, amount, date, receiptNumber, paymentType, monthsCovered } = req.body;
    const transaction = db.transaction(() => {
      const rentalIncome = db.prepare('SELECT total_paid, months_paid, tenant_name, property_type FROM rental_incomes WHERE id = ?').get(rentalIncomeId) as any;
      const newTotalPaid = (rentalIncome.total_paid || 0) + amount;
      
      let monthsPaidObj = {};
      try {
        monthsPaidObj = JSON.parse(rentalIncome.months_paid || '{}');
      } catch (e) {}
      
      monthsCovered.forEach((m: number) => {
        (monthsPaidObj as any)[m] = paymentType;
      });

      db.prepare('UPDATE rental_incomes SET total_paid = ?, months_paid = ? WHERE id = ?')
        .run(newTotalPaid, JSON.stringify(monthsPaidObj), rentalIncomeId);

      // Record in bank or cashbox
      let bankOpId = null;
      let cashboxOpId = null;
      const description = `RECEIPT|${receiptNumber}`;
      const name = `RENTAL_INCOME|${rentalIncome.property_type}|${rentalIncome.tenant_name}`;

      if (paymentType === 'bank') {
        const result = db.prepare('INSERT INTO bank_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(syndicId, 'deposit', amount, name, date, description);
        bankOpId = result.lastInsertRowid;
      } else {
        const result = db.prepare('INSERT INTO cashbox_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(syndicId, 'deposit', amount, name, date, description);
        cashboxOpId = result.lastInsertRowid;
      }

      db.prepare('INSERT INTO rental_payments (rental_income_id, syndic_id, amount, date, receipt_number, payment_type, months_covered, bank_op_id, cashbox_op_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(rentalIncomeId, syndicId, amount, date, receiptNumber, paymentType, JSON.stringify(monthsCovered), bankOpId, cashboxOpId);

      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/rental-payments/:id', (req, res) => {
    const { id } = req.params;
    const transaction = db.transaction(() => {
      const payment = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(id) as any;
      if (!payment) throw new Error('Payment not found');

      const rentalIncome = db.prepare('SELECT total_paid, months_paid FROM rental_incomes WHERE id = ?').get(payment.rental_income_id) as any;
      const newTotalPaid = Math.max(0, (rentalIncome.total_paid || 0) - payment.amount);
      
      let monthsPaidObj = {};
      try {
        monthsPaidObj = JSON.parse(rentalIncome.months_paid || '{}');
      } catch (e) {}
      
      const monthsCovered = JSON.parse(payment.months_covered || '[]');
      monthsCovered.forEach((m: number) => {
        delete (monthsPaidObj as any)[m];
      });

      db.prepare('UPDATE rental_incomes SET total_paid = ?, months_paid = ? WHERE id = ?')
        .run(newTotalPaid, JSON.stringify(monthsPaidObj), payment.rental_income_id);

      // Delete from bank or cashbox
      if (payment.bank_op_id) {
        db.prepare('DELETE FROM bank_operations WHERE id = ?').run(payment.bank_op_id);
      }
      if (payment.cashbox_op_id) {
        db.prepare('DELETE FROM cashbox_operations WHERE id = ?').run(payment.cashbox_op_id);
      }

      db.prepare('DELETE FROM rental_payments WHERE id = ?').run(id);
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/rental-payments/:id', (req, res) => {
    const { id } = req.params;
    const { amount, date, payment_type } = req.body;
    const transaction = db.transaction(() => {
      const oldPayment = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(id) as any;
      if (!oldPayment) throw new Error('Payment not found');

      const rentalIncome = db.prepare('SELECT total_paid, months_paid, tenant_name FROM rental_incomes WHERE id = ?').get(oldPayment.rental_income_id) as any;
      const newTotalPaid = (rentalIncome.total_paid || 0) - oldPayment.amount + amount;
      
      let monthsPaidObj = {};
      try {
        monthsPaidObj = JSON.parse(rentalIncome.months_paid || '{}');
      } catch (e) {}
      
      const monthsCovered = JSON.parse(oldPayment.months_covered || '[]');
      monthsCovered.forEach((m: number) => {
        (monthsPaidObj as any)[m] = payment_type;
      });

      db.prepare('UPDATE rental_incomes SET total_paid = ?, months_paid = ? WHERE id = ?')
        .run(newTotalPaid, JSON.stringify(monthsPaidObj), oldPayment.rental_income_id);

      // Update or recreate bank/cashbox operation
      let bankOpId = oldPayment.bank_op_id;
      let cashboxOpId = oldPayment.cashbox_op_id;
      const description = `RECEIPT|${oldPayment.receipt_number}`;
      const name = `RENTAL_INCOME|${rentalIncome.property_type}|${rentalIncome.tenant_name}`;

      // If payment type changed, delete old and create new
      if ((payment_type === 'bank' && cashboxOpId) || (payment_type === 'cash' && bankOpId)) {
        if (bankOpId) db.prepare('DELETE FROM bank_operations WHERE id = ?').run(bankOpId);
        if (cashboxOpId) db.prepare('DELETE FROM cashbox_operations WHERE id = ?').run(cashboxOpId);
        bankOpId = null;
        cashboxOpId = null;
      }

      if (payment_type === 'bank') {
        if (bankOpId) {
          db.prepare('UPDATE bank_operations SET amount = ?, date = ?, name = ?, description = ? WHERE id = ?')
            .run(amount, date, name, description, bankOpId);
        } else {
          const result = db.prepare('INSERT INTO bank_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(oldPayment.syndic_id, 'deposit', amount, name, date, description);
          bankOpId = result.lastInsertRowid;
        }
      } else {
        if (cashboxOpId) {
          db.prepare('UPDATE cashbox_operations SET amount = ?, date = ?, name = ?, description = ? WHERE id = ?')
            .run(amount, date, name, description, cashboxOpId);
        } else {
          const result = db.prepare('INSERT INTO cashbox_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(oldPayment.syndic_id, 'deposit', amount, name, date, description);
          cashboxOpId = result.lastInsertRowid;
        }
      }

      db.prepare('UPDATE rental_payments SET amount = ?, date = ?, payment_type = ?, bank_op_id = ?, cashbox_op_id = ? WHERE id = ?')
        .run(amount, date, payment_type, bankOpId, cashboxOpId, id);

      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/syndic/rental-incomes', (req, res) => {
    const { syndicId } = req.query;
    try {
      const incomes = db.prepare('SELECT * FROM rental_incomes WHERE syndic_id = ? ORDER BY id DESC').all(syndicId);
      res.json(incomes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/rental-incomes', (req, res) => {
    const { 
      syndicId, 
      propertyType, property_type,
      propertyAddress, property_address,
      tenantName, tenant_name,
      phone, 
      rentalPrice, rental_price,
      receiptNumber, receipt_number,
      monthsPaid, months_paid,
      monthsUnpaid, months_unpaid,
      year, 
      date,
      totalPaid, total_paid,
      status,
      endDate, end_date,
      paymentType
    } = req.body;
    
    const transaction = db.transaction(() => {
      const stmt = db.prepare('INSERT INTO rental_incomes (syndic_id, property_type, property_address, tenant_name, phone, rental_price, receipt_number, months_paid, months_unpaid, year, date, total_paid, status, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const result = stmt.run(
        syndicId, 
        propertyType || property_type, 
        propertyAddress || property_address || '',
        tenantName || tenant_name, 
        phone, 
        rentalPrice || rental_price, 
        receiptNumber || receipt_number, 
        monthsPaid || months_paid, 
        monthsUnpaid || months_unpaid, 
        year, 
        date,
        totalPaid || total_paid || 0,
        status || 'active',
        endDate || end_date
      );
      
      const rentalIncomeId = result.lastInsertRowid;
      const initialMonthsPaid = Number(monthsPaid || months_paid) || 0;
      const price = Number(rentalPrice || rental_price) || 0;
      const amount = price * initialMonthsPaid;
      
      if (amount > 0) {
        let bankOpId = null;
        let cashboxOpId = null;
        const description = `RECEIPT|${receiptNumber || receipt_number}`;
        const name = `RENTAL_INCOME|${propertyType || property_type}|${tenantName || tenant_name}`;

        if (paymentType === 'bank') {
          const bankResult = db.prepare('INSERT INTO bank_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(syndicId, 'deposit', amount, name, date, description);
          bankOpId = bankResult.lastInsertRowid;
        } else {
          const cashboxResult = db.prepare('INSERT INTO cashbox_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(syndicId, 'deposit', amount, name, date, description);
          cashboxOpId = cashboxResult.lastInsertRowid;
        }

        const monthsCovered = [];
        for (let i = 0; i < initialMonthsPaid; i++) {
          monthsCovered.push(i);
        }

        db.prepare('INSERT INTO rental_payments (rental_income_id, syndic_id, amount, date, receipt_number, payment_type, months_covered, bank_op_id, cashbox_op_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(rentalIncomeId, syndicId, amount, date, receiptNumber || receipt_number, paymentType || 'cash', JSON.stringify(monthsCovered), bankOpId, cashboxOpId);
      }
      
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/rental-incomes/:id', (req, res) => {
    const transaction = db.transaction(() => {
      const id = req.params.id;
      const payments = db.prepare('SELECT bank_op_id, cashbox_op_id FROM rental_payments WHERE rental_income_id = ?').all(id) as any[];
      
      for (const p of payments) {
        if (p.bank_op_id) {
          db.prepare('DELETE FROM bank_operations WHERE id = ?').run(p.bank_op_id);
        }
        if (p.cashbox_op_id) {
          db.prepare('DELETE FROM cashbox_operations WHERE id = ?').run(p.cashbox_op_id);
        }
      }
      
      db.prepare('DELETE FROM rental_payments WHERE rental_income_id = ?').run(id);
      db.prepare('DELETE FROM rental_incomes WHERE id = ?').run(id);
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/rental-incomes/all/:syndicId', (req, res) => {
    try {
      db.prepare('DELETE FROM rental_incomes WHERE syndic_id = ?').run(req.params.syndicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/rental-incomes/:id', (req, res) => {
    const { id } = req.params;
    const { 
      propertyType, property_type,
      propertyAddress, property_address,
      tenantName, tenant_name,
      phone, 
      rentalPrice, rental_price,
      receiptNumber, receipt_number,
      monthsPaid, months_paid,
      monthsUnpaid, months_unpaid,
      year, 
      date,
      totalPaid, total_paid,
      status,
      endDate, end_date
    } = req.body;
    try {
      const stmt = db.prepare('UPDATE rental_incomes SET property_type = ?, property_address = ?, tenant_name = ?, phone = ?, rental_price = ?, receipt_number = ?, months_paid = ?, months_unpaid = ?, year = ?, date = ?, total_paid = ?, status = ?, end_date = ? WHERE id = ?');
      stmt.run(
        propertyType || property_type, 
        propertyAddress || property_address || '',
        tenantName || tenant_name, 
        phone, 
        rentalPrice || rental_price, 
        receiptNumber || receipt_number, 
        monthsPaid || months_paid, 
        monthsUnpaid || months_unpaid, 
        year, 
        date, 
        totalPaid || total_paid || 0,
        status || 'active',
        endDate || end_date,
        id
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Other Incomes
  app.get('/api/syndic/other-incomes', (req, res) => {
    const { syndicId } = req.query;
    try {
      const incomes = db.prepare('SELECT * FROM other_incomes WHERE syndic_id = ? ORDER BY id DESC').all(syndicId);
      res.json(incomes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/syndic/max-receipt-number', (req, res) => {
    const { syndicId, year, type } = req.query;
    try {
      const prefix = type === 'payment' || type === 'project_payment' ? `P${year}/` : `R${year}/`;
      const likePattern = `${prefix}%`;
      let query = '';
      let params: any[] = [];

      if (type === 'payment' || type === 'project_payment') {
        query = `
          SELECT MAX(CAST(SUBSTR(receipt_number, LENGTH(?) + 1) AS INTEGER)) as max_num
          FROM (
            SELECT receipt_number FROM payments WHERE syndic_id = ? AND receipt_number LIKE ?
            UNION ALL
            SELECT receipt_number FROM project_payments WHERE syndic_id = ? AND receipt_number LIKE ?
          )
        `;
        params = [prefix, syndicId, likePattern, syndicId, likePattern];
      } else {
        query = `
          SELECT MAX(CAST(SUBSTR(receipt_number, LENGTH(?) + 1) AS INTEGER)) as max_num
          FROM (
            SELECT receipt_number FROM rental_incomes WHERE syndic_id = ? AND receipt_number LIKE ?
            UNION ALL
            SELECT receipt_number FROM other_incomes WHERE syndic_id = ? AND receipt_number LIKE ?
            UNION ALL
            SELECT receipt_number FROM rental_payments WHERE syndic_id = ? AND receipt_number LIKE ?
          )
        `;
        params = [prefix, syndicId, likePattern, syndicId, likePattern, syndicId, likePattern];
      }
      const result = db.prepare(query).get(...params) as any;
      res.json({ maxNum: result.max_num || 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/other-incomes', (req, res) => {
    const { syndicId, incomeType, contributorName, amount, date, receiptNumber, notes, paymentType, propertyAddress, propertyType } = req.body;
    const transaction = db.transaction(() => {
      // Record in bank or cashbox
      let bankOpId = null;
      let cashboxOpId = null;
      const description = `RECEIPT|${receiptNumber}`;
      const name = `OTHER_INCOME|${incomeType}|${contributorName}`;

      if (paymentType === 'bank') {
        const result = db.prepare('INSERT INTO bank_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(syndicId, 'deposit', amount, name, date, description);
        bankOpId = result.lastInsertRowid;
      } else {
        const result = db.prepare('INSERT INTO cashbox_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(syndicId, 'deposit', amount, name, date, description);
        cashboxOpId = result.lastInsertRowid;
      }

      const stmt = db.prepare('INSERT INTO other_incomes (syndic_id, income_type, contributor_name, amount, date, receipt_number, notes, bank_op_id, cashbox_op_id, property_address, property_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      stmt.run(syndicId, incomeType, contributorName, amount, date, receiptNumber, notes, bankOpId, cashboxOpId, propertyAddress || '', propertyType || '');
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/other-incomes/:id', (req, res) => {
    const { id } = req.params;
    const transaction = db.transaction(() => {
      const income = db.prepare('SELECT * FROM other_incomes WHERE id = ?').get(id) as any;
      if (!income) throw new Error('Income not found');

      // Delete from bank or cashbox
      if (income.bank_op_id) {
        db.prepare('DELETE FROM bank_operations WHERE id = ?').run(income.bank_op_id);
      }
      if (income.cashbox_op_id) {
        db.prepare('DELETE FROM cashbox_operations WHERE id = ?').run(income.cashbox_op_id);
      }

      db.prepare('DELETE FROM other_incomes WHERE id = ?').run(id);
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/other-incomes/all/:syndicId', (req, res) => {
    try {
      db.prepare('DELETE FROM other_incomes WHERE syndic_id = ?').run(req.params.syndicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put('/api/syndic/other-incomes/:id', (req, res) => {
    const { id } = req.params;
    const { incomeType, contributorName, amount, date, receiptNumber, notes, paymentType, propertyAddress, propertyType } = req.body;
    
    const transaction = db.transaction(() => {
      const income = db.prepare('SELECT bank_op_id, cashbox_op_id, payment_type FROM other_incomes WHERE id = ?').get(id) as any;
      if (!income) throw new Error('Income not found');

      const description = `RECEIPT|${receiptNumber}`;
      const name = `OTHER_INCOME|${incomeType}|${contributorName}`;

      let newBankOpId = income.bank_op_id;
      let newCashboxOpId = income.cashbox_op_id;

      if (income.payment_type !== paymentType) {
        // Payment type changed, delete old operation and create new one
        if (income.bank_op_id) {
          db.prepare('DELETE FROM bank_operations WHERE id = ?').run(income.bank_op_id);
          newBankOpId = null;
        }
        if (income.cashbox_op_id) {
          db.prepare('DELETE FROM cashbox_operations WHERE id = ?').run(income.cashbox_op_id);
          newCashboxOpId = null;
        }

        const syndicId = db.prepare('SELECT syndic_id FROM other_incomes WHERE id = ?').get(id) as any;
        
        if (paymentType === 'bank') {
          const result = db.prepare('INSERT INTO bank_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(syndicId.syndic_id, 'deposit', amount, name, date, description);
          newBankOpId = result.lastInsertRowid;
        } else {
          const result = db.prepare('INSERT INTO cashbox_operations (syndic_id, operation_type, amount, name, date, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(syndicId.syndic_id, 'deposit', amount, name, date, description);
          newCashboxOpId = result.lastInsertRowid;
        }
      } else {
        // Payment type unchanged, just update existing operation
        if (income.bank_op_id) {
          db.prepare('UPDATE bank_operations SET amount = ?, name = ?, date = ?, description = ? WHERE id = ?')
            .run(amount, name, date, description, income.bank_op_id);
        }
        if (income.cashbox_op_id) {
          db.prepare('UPDATE cashbox_operations SET amount = ?, name = ?, date = ?, description = ? WHERE id = ?')
            .run(amount, name, date, description, income.cashbox_op_id);
        }
      }

      const stmt = db.prepare('UPDATE other_incomes SET income_type = ?, contributor_name = ?, amount = ?, date = ?, receipt_number = ?, notes = ?, payment_type = ?, bank_op_id = ?, cashbox_op_id = ?, property_address = ?, property_type = ? WHERE id = ?');
      stmt.run(incomeType, contributorName, amount, date, receiptNumber, notes, paymentType, newBankOpId, newCashboxOpId, propertyAddress || '', propertyType || '', id);
      return { success: true };
    });

    try {
      const result = transaction();
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Profile
  app.get(['/api/syndic/profile', '/api/syndic/profile/:id'], (req, res) => {
    try {
      const id = req.params.id;
      if (!id || id === 'undefined' || id === 'null') {
        return res.status(400).json({ error: 'Missing syndic id' });
      }
      const user = db.prepare("SELECT id, full_name, email, phone, profile_picture, stamp_signature, residence_name, residence_address, monthly_fee, currency, resident_monthly_fee, membership_fee, certified_year, certified_month, initial_bank_balance, initial_cashbox_balance, initial_uncollected_balance, initial_unpaid_balance, show_apartments, receipt_settings FROM users WHERE id = ? AND role = 'syndic'").get(id);
      if (!user) {
        return res.status(404).json({ error: 'Syndic profile not found' });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/syndic/profile/:id', (req, res) => {
    const { 
      fullName, full_name,
      email, 
      phone, 
      profilePicture, profile_picture,
      stampSignature, stamp_signature,
      residenceName, residence_name,
      residenceAddress, residence_address,
      monthlyFee, monthly_fee,
      currency, 
      residentMonthlyFee, resident_monthly_fee,
      membershipFee, membership_fee,
      certifiedYear, certified_year,
      certifiedMonth, certified_month,
      initialBankBalance, initial_bank_balance,
      initialCashboxBalance, initial_cashbox_balance,
      initialUncollectedBalance, initial_uncollected_balance,
      initialUnpaidBalance, initial_unpaid_balance,
      showApartments, show_apartments,
      receiptSettings, receipt_settings,
      currentPassword, newPassword
    } = req.body;

    const finalFullName = fullName ?? full_name ?? 'Syndic';
    const finalProfilePicture = profilePicture ?? profile_picture ?? null;
    const finalStampSignature = stampSignature ?? stamp_signature ?? null;
    const finalResidenceName = residenceName ?? residence_name ?? '';
    const finalResidenceAddress = residenceAddress ?? residence_address ?? '';
    const finalPhone = phone ?? '';
    const finalMonthlyFee = monthlyFee !== undefined ? monthlyFee : monthly_fee;
    const finalResidentMonthlyFee = residentMonthlyFee !== undefined ? residentMonthlyFee : resident_monthly_fee;
    const finalMembershipFee = membershipFee !== undefined ? membershipFee : membership_fee;
    const finalInitialBankBalance = initialBankBalance !== undefined ? initialBankBalance : initial_bank_balance;
    const finalInitialCashboxBalance = initialCashboxBalance !== undefined ? initialCashboxBalance : initial_cashbox_balance;
    const finalInitialUncollectedBalance = initialUncollectedBalance !== undefined ? initialUncollectedBalance : initial_uncollected_balance;
    const finalInitialUnpaidBalance = initialUnpaidBalance !== undefined ? initialUnpaidBalance : initial_unpaid_balance;
    const finalCertifiedYear = certifiedYear !== undefined ? certifiedYear : certified_year;
    const finalCertifiedMonth = certifiedMonth !== undefined ? certifiedMonth : certified_month;
    const finalShowApartments = showApartments !== undefined ? showApartments : show_apartments;
    const finalReceiptSettings = receiptSettings !== undefined ? receiptSettings : receipt_settings;

    try {
      if (email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(?) AND id != ?').get(email.trim(), Number(req.params.id));
        if (existingUser) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        const existingResident = db.prepare('SELECT id FROM residents WHERE LOWER(TRIM(email)) = LOWER(?)').get(email.trim());
        if (existingResident) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      if (newPassword) {
        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.params.id) as any;
        if (user.password !== currentPassword) {
          return res.status(400).json({ error: 'Incorrect current password' });
        }
      }

      let query = 'UPDATE users SET full_name = ?, email = ?, phone = ?, profile_picture = ?, stamp_signature = ?, residence_name = ?, residence_address = ?, monthly_fee = ?, currency = ?, resident_monthly_fee = ?, membership_fee = ?, certified_year = ?, certified_month = ?, initial_bank_balance = ?, initial_cashbox_balance = ?, initial_uncollected_balance = ?, initial_unpaid_balance = ?, show_apartments = ?, receipt_settings = ?';
      const params = [
        finalFullName, email, finalPhone, finalProfilePicture, finalStampSignature, 
        finalResidenceName, finalResidenceAddress, finalMonthlyFee, currency, 
        finalResidentMonthlyFee, 
        finalMembershipFee, 
        finalCertifiedYear, finalCertifiedMonth, finalInitialBankBalance || 0, 
        finalInitialCashboxBalance || 0, finalInitialUncollectedBalance || 0, finalInitialUnpaidBalance || 0, 
        finalShowApartments === undefined ? 1 : (finalShowApartments ? 1 : 0), 
        finalReceiptSettings ? (typeof finalReceiptSettings === 'string' ? finalReceiptSettings : JSON.stringify(finalReceiptSettings)) : null
      ];

      if (newPassword) {
        query += ', password = ?';
        params.push(newPassword);
      }

      query += ' WHERE id = ?';
      params.push(req.params.id);

      const stmt = db.prepare(query);
      stmt.run(...params);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Update error:', error.message);
      res.status(400).json({ error: error.message });
    }
  });

  // Resident Routes
  app.get(['/api/resident/profile', '/api/resident/profile/:id'], (req, res) => {
    try {
      const id = req.params.id;
      if (!id || id === 'undefined' || id === 'null') {
        return res.status(400).json({ error: 'Missing resident id' });
      }
      const resident = db.prepare(`
        SELECT r.*, u.full_name as syndic_name, u.currency, u.resident_monthly_fee, u.membership_fee, u.certified_year, u.certified_month
        FROM residents r
        JOIN users u ON r.syndic_id = u.id
        WHERE r.id = ?
      `).get(id);
      if (!resident) {
        return res.status(404).json({ error: 'Resident profile not found' });
      }
      res.json(resident);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/resident/profile/:id', (req, res) => {
    const { id } = req.params;
    const { fullName, email, phone, password, profilePicture, currentPassword, newPassword } = req.body;
    try {
      if (email) {
        // Check for duplicate email
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        
        const existingResident = db.prepare('SELECT id FROM residents WHERE email = ? AND id != ?').get(email, Number(id));
        if (existingResident) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      if (newPassword) {
        const resident = db.prepare('SELECT password FROM residents WHERE id = ?').get(id) as any;
        if (resident.password !== currentPassword) {
          return res.status(400).json({ error: 'Incorrect current password' });
        }
      }

      let query = 'UPDATE residents SET full_name = ?, email = ?, phone = ?, profile_picture = ?';
      const params = [fullName, email, phone, profilePicture];
      
      if (newPassword) {
        query += ', password = ?';
        params.push(newPassword);
      } else if (password) {
        query += ', password = ?';
        params.push(password);
      }
      
      query += ' WHERE id = ?';
      params.push(id);
      
      const stmt = db.prepare(query);
      stmt.run(...params);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/resident/payments/:id', (req, res) => {
    try {
      const payments = db.prepare('SELECT *, \'normal\' as type FROM payments WHERE resident_id = ?').all(req.params.id);
      const projectPayments = db.prepare('SELECT pp.*, p.name as project_name, \'project\' as type FROM project_payments pp JOIN projects p ON pp.project_id = p.id WHERE pp.resident_id = ?').all(req.params.id);
      
      const allPayments = [...payments, ...projectPayments].sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        // If dates are equal, sort by ID descending (last entered first)
        return b.id - a.id;
      });
      
      res.json(allPayments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Notifications

  app.post('/api/resident/notifications', (req, res) => {
    const { senderId, title, message, recipientId, type } = req.body;
    try {
      db.prepare('INSERT INTO notifications (sender_id, recipient_id, title, message, type) VALUES (?, ?, ?, ?, ?)').run(senderId, recipientId, title, message, type);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/notifications', (req, res) => {
    const { senderId, title, message, recipientId, recipientIds, type } = req.body;
    console.log('Syndic sending notification:', { senderId, recipientId, recipientIds, type, title });

    if (!senderId) {
      return res.status(400).json({ error: 'Sender ID is required' });
    }

    try {
      const stmt = db.prepare('INSERT INTO notifications (sender_id, recipient_id, title, message, type) VALUES (?, ?, ?, ?, ?)');
      
      if (recipientIds && Array.isArray(recipientIds) && recipientIds.length > 0) {
        const transaction = db.transaction((ids) => {
          for (const id of ids) stmt.run(senderId, id, title, message, type);
        });
        transaction(recipientIds);
      } else if (recipientId && recipientId !== 'all') {
         stmt.run(senderId, recipientId, title, message, type);
      } else {
        // Handle "all" case (recipientId is null or 'all')
        const residents = db.prepare('SELECT id FROM residents WHERE syndic_id = ? AND is_active = 1').all(senderId) as any[];
        console.log(`Sending to all ${residents.length} residents of syndic ${senderId}`);
        
        if (residents.length > 0) {
          const transaction = db.transaction((residents) => {
            for (const resident of residents) stmt.run(senderId, resident.id, title, message, type);
          });
          transaction(residents);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/notifications/:userId', (req, res) => {
    try {
      console.log('Fetching received notifications for user:', req.params.userId);
      const notifications = db.prepare(`
        SELECT n.*, 
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN u.full_name
            WHEN n.type = 'resident_to_syndic' THEN r.full_name
            ELSE 'System'
          END as sender_name,
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN u.email
            WHEN n.type = 'resident_to_syndic' THEN r.email
            ELSE ''
          END as sender_email
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id 
        LEFT JOIN residents r ON n.sender_id = r.id 
        WHERE n.recipient_id = ? AND n.is_deleted_recipient = 0 
        ORDER BY n.created_at DESC
      `).all(req.params.userId);
      console.log(`Found ${notifications.length} received notifications`);
      res.json(notifications);
    } catch (error: any) {
      console.error('Error fetching received notifications:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/notifications/sent/:userId', (req, res) => {
    try {
      console.log('Fetching sent notifications for user:', req.params.userId);
      const notifications = db.prepare(`
        SELECT n.*, 
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN r.full_name
            WHEN n.type = 'resident_to_syndic' THEN u.full_name
            ELSE 'System'
          END as recipient_name,
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN r.email
            WHEN n.type = 'resident_to_syndic' THEN u.email
            ELSE ''
          END as recipient_email
        FROM notifications n
        LEFT JOIN users u ON n.recipient_id = u.id 
        LEFT JOIN residents r ON n.recipient_id = r.id 
        WHERE n.sender_id = ? AND n.is_deleted_sender = 0 
        ORDER BY n.created_at DESC
      `).all(req.params.userId);
      console.log(`Found ${notifications.length} sent notifications`);
      res.json(notifications);
    } catch (error: any) {
      console.error('Error fetching sent notifications:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/notifications/trash/:userId', (req, res) => {
    try {
      const notifications = db.prepare(`
        SELECT n.*, 
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN us.full_name
            WHEN n.type = 'resident_to_syndic' THEN rs.full_name
            ELSE 'System'
          END as sender_name,
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN us.email
            WHEN n.type = 'resident_to_syndic' THEN rs.email
            ELSE ''
          END as sender_email,
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN rr.full_name
            WHEN n.type = 'resident_to_syndic' THEN ur.full_name
            ELSE 'System'
          END as recipient_name,
          CASE 
            WHEN n.type = 'syndic_to_resident' THEN rr.email
            WHEN n.type = 'resident_to_syndic' THEN ur.email
            ELSE ''
          END as recipient_email
        FROM notifications n
        LEFT JOIN users us ON n.sender_id = us.id 
        LEFT JOIN residents rs ON n.sender_id = rs.id 
        LEFT JOIN users ur ON n.recipient_id = ur.id 
        LEFT JOIN residents rr ON n.recipient_id = rr.id 
        WHERE (n.recipient_id = ? AND n.is_deleted_recipient = 1)
        OR (n.sender_id = ? AND n.is_deleted_sender = 1)
        ORDER BY n.created_at DESC
      `).all(req.params.userId, req.params.userId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/notifications/:id/restore', (req, res) => {
    const { userId } = req.body;
    try {
      db.prepare(`
        UPDATE notifications 
        SET is_deleted_recipient = CASE WHEN recipient_id = ? THEN 0 ELSE is_deleted_recipient END,
            is_deleted_sender = CASE WHEN sender_id = ? THEN 0 ELSE is_deleted_sender END
        WHERE id = ?
      `).run(userId, userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/notifications/:id/read', (req, res) => {
    try {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/notifications/read-all/:userId', (req, res) => {
    try {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ?').run(req.params.userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/notifications/clear-all/:userId', (req, res) => {
    try {
      db.prepare('DELETE FROM notifications WHERE recipient_id = ?').run(req.params.userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/notifications/:id', (req, res) => {
    const { userId } = req.query;
    try {
      db.prepare(`
        UPDATE notifications 
        SET is_deleted_recipient = CASE WHEN recipient_id = ? THEN 1 ELSE is_deleted_recipient END,
            is_deleted_sender = CASE WHEN sender_id = ? THEN 1 ELSE is_deleted_sender END
        WHERE id = ?
      `).run(userId, userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/notifications/:id/permanent', (req, res) => {
    try {
      db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auth (updated to return ID)
  app.post('/api/login', (req, res) => {
    const { identifier: rawIdentifier, password: rawPassword } = req.body;
    const identifier = String(rawIdentifier || '').trim();
    const password = String(rawPassword || '').trim();
    
    console.log('Login attempt:', identifier);
    
    try {
      // 1. Check users table (Syndic)
      let user = db.prepare(`
        SELECT * FROM users 
        WHERE (LOWER(TRIM(email)) = LOWER(?) OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = ?) 
        AND password = ? AND role = 'syndic'
      `).get(identifier, identifier, identifier.replace(/[\s\-+]/g, ''), password) as any;
      if (user) {
        if (user.is_active === 0) {
          return res.status(401).json({ error: 'Account deactivated or expired' });
        }
        return res.json({ success: true, role: user.role, id: user.id });
      }

      // 2. Check residents table (Resident with PIN or Password)
      let resident = db.prepare(`
        SELECT * FROM residents 
        WHERE (LOWER(TRIM(email)) = LOWER(?) OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = ?) 
        AND pin = ?
      `).get(identifier, identifier, identifier.replace(/[\s\-+]/g, ''), password) as any;
      
      // If not found with PIN, try with Password
      if (!resident) {
        resident = db.prepare(`
          SELECT * FROM residents 
          WHERE (LOWER(TRIM(email)) = LOWER(?) OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = ?) 
          AND password = ?
        `).get(identifier, identifier, identifier.replace(/[\s\-+]/g, ''), password) as any;
      }

      if (resident) {
        if (resident.is_active === 0) {
          return res.status(401).json({ error: 'Resident account deactivated' });
        }
        return res.json({ success: true, role: 'resident', id: resident.id });
      }

      res.status(401).json({ error: 'Invalid credentials' });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/complaints', (req, res) => {
    const { residentId, syndicId, subject, description } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO complaints (resident_id, syndic_id, subject, description) VALUES (?, ?, ?, ?)');
      const info = stmt.run(residentId, syndicId, subject, description);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/syndic/announcements/:syndicId', (req, res) => {
    try {
      const announcements = db.prepare('SELECT * FROM announcements WHERE syndic_id = ? ORDER BY created_at DESC').all(req.params.syndicId);
      res.json(announcements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/announcements', (req, res) => {
    const { syndicId, title, message } = req.body;
    try {
      db.prepare('INSERT INTO announcements (syndic_id, title, message) VALUES (?, ?, ?)').run(syndicId, title, message);
      
      // Add notifications for all residents
      const residents = db.prepare('SELECT id FROM residents WHERE syndic_id = ?').all(syndicId) as any[];
      const insertNotif = db.prepare('INSERT INTO notifications (sender_id, recipient_id, title, message, type) VALUES (?, ?, ?, ?, ?)');
      residents.forEach(r => {
        insertNotif.run(syndicId, r.id, 'Nouvelle annonce', title, 'announcement');
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/syndic/reminder-settings/:syndicId', (req, res) => {
    try {
      const settings = db.prepare('SELECT reminder_message_template, reminder_deadline_day, reminder_days_between, reminder_max_times FROM users WHERE id = ?').get(req.params.syndicId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/syndic/reminder-settings/:syndicId', (req, res) => {
    const { messageTemplate, deadlineDay, daysBetween, maxTimes } = req.body;
    try {
      db.prepare('UPDATE users SET reminder_message_template = ?, reminder_deadline_day = ?, reminder_days_between = ?, reminder_max_times = ? WHERE id = ?').run(messageTemplate, deadlineDay, daysBetween, maxTimes, req.params.syndicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/resident/:id/reminder-status', (req, res) => {
    const { enabled } = req.body;
    try {
      db.prepare('UPDATE residents SET automatic_reminders_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syndic/automatic-reminders', (req, res) => {
    const { syndicId, residentId, message } = req.body;
    try {
      db.prepare('INSERT INTO automatic_reminders_log (syndic_id, resident_id, message) VALUES (?, ?, ?)').run(syndicId, residentId, message);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/syndic/bulk-reminders', (req, res) => {
    const { syndicId, reminders } = req.body;
    try {
      const insertLog = db.prepare('INSERT INTO automatic_reminders_log (syndic_id, resident_id, message) VALUES (?, ?, ?)');
      const insertNotif = db.prepare('INSERT INTO notifications (sender_id, recipient_id, title, message, type) VALUES (?, ?, ?, ?, ?)');
      
      const transaction = db.transaction((rems) => {
        for (const rem of rems) {
          insertLog.run(syndicId, rem.residentId, rem.message);
          insertNotif.run(syndicId, rem.residentId, 'Rappel automatique', rem.message, 'system');
        }
      });
      
      transaction(reminders);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/syndic/automatic-reminders/:syndicId', (req, res) => {
    try {
      const reminders = db.prepare(`
        SELECT a.*, r.full_name as resident_name, r.building, r.apartment 
        FROM automatic_reminders_log a
        LEFT JOIN residents r ON a.resident_id = r.id
        WHERE a.syndic_id = ? 
        ORDER BY a.created_at DESC
      `).all(req.params.syndicId);
      res.json(reminders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/automatic-reminders/clear-all/:syndicId', (req, res) => {
    try {
      db.prepare('DELETE FROM automatic_reminders_log WHERE syndic_id = ?').run(req.params.syndicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/automatic-reminders/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM automatic_reminders_log WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/resident/automatic-reminders/:residentId', (req, res) => {
    try {
      const reminders = db.prepare(`
        SELECT a.*, u.full_name as syndic_name 
        FROM automatic_reminders_log a
        LEFT JOIN users u ON a.syndic_id = u.id
        WHERE a.resident_id = ? 
        ORDER BY a.created_at DESC
      `).all(req.params.residentId);
      res.json(reminders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/syndic/announcements/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/complaints/:id/answer', (req, res) => {
    const { answer } = req.body;
    try {
      db.prepare('UPDATE complaints SET answer = ? WHERE id = ?').run(answer, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/resident/complaints', (req, res) => {
    const { residentId, syndicId, subject, description } = req.body;
    try {
      db.prepare('INSERT INTO complaints (resident_id, syndic_id, subject, description) VALUES (?, ?, ?, ?)').run(residentId, syndicId, subject, description);
      
      // Add notification for syndic
      db.prepare('INSERT INTO notifications (sender_id, recipient_id, title, message, type) VALUES (?, ?, ?, ?, ?)')
        .run(residentId, syndicId, 'Nouvelle plainte', subject, 'complaint');
        
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/resident/complaints/:residentId', (req, res) => {
    try {
      const complaints = db.prepare('SELECT * FROM complaints WHERE resident_id = ? ORDER BY created_at DESC').all(req.params.residentId);
      res.json(complaints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/complaints/:id', (req, res) => {
    const { status } = req.body;
    try {
      db.prepare('UPDATE complaints SET status = ? WHERE id = ?').run(status, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/complaints/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM complaints WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/syndic/complaints/:syndicId', (req, res) => {
    try {
      const complaints = db.prepare('SELECT * FROM complaints WHERE syndic_id = ? ORDER BY created_at DESC').all(req.params.syndicId);
      res.json(complaints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Specific 404 handler for unmatched API requests so they return JSON rather than Vite's index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    console.log('Vite server created');
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.NODE_ENV === 'production' && process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 3000;
  const processAutomaticReminders = () => {
    try {
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Get all syndics with their settings
      const syndics = db.prepare("SELECT id, reminder_message_template, reminder_deadline_day, reminder_days_between, reminder_max_times FROM users WHERE role = 'syndic'").all() as any[];

      for (const syndic of syndics) {
        if (currentDay >= (syndic.reminder_deadline_day || 5)) {
          // Get all residents for this syndic who have automatic reminders enabled
          const residents = db.prepare('SELECT id, full_name, status, current_balance FROM residents WHERE syndic_id = ? AND automatic_reminders_enabled = 1').all(syndic.id) as any[];
          
          for (const resident of residents) {
            if (resident.current_balance < 0) {
              const logs = db.prepare('SELECT created_at FROM automatic_reminders_log WHERE syndic_id = ? AND resident_id = ? AND strftime("%m", created_at) = ? AND strftime("%Y", created_at) = ? ORDER BY created_at DESC').all(syndic.id, resident.id, String(currentMonth).padStart(2, '0'), String(currentYear)) as any[];
              
              const maxTimes = syndic.reminder_max_times || 3;
              const daysBetween = syndic.reminder_days_between || 3;

              if (logs.length < maxTimes) {
                let shouldSend = false;
                if (logs.length === 0) {
                  shouldSend = true;
                } else {
                  const lastSentDate = new Date(logs[0].created_at);
                  const diffTime = Math.abs(now.getTime() - lastSentDate.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  if (diffDays >= daysBetween) {
                    shouldSend = true;
                  }
                }

                if (shouldSend) {
                  const message = (syndic.reminder_message_template || 'Bonjour {{name}}, nous vous rappelons que vous avez un solde impayé de {{amount}} DH. Merci de régulariser votre situation dans les plus brefs délais.')
                    .replace('{{name}}', resident.full_name)
                    .replace('{{amount}}', Math.abs(resident.current_balance).toString());

                  db.prepare('INSERT INTO automatic_reminders_log (syndic_id, resident_id, message) VALUES (?, ?, ?)').run(syndic.id, resident.id, message);
                  db.prepare('INSERT INTO notifications (sender_id, recipient_id, title, message, type) VALUES (?, ?, ?, ?, ?)').run(syndic.id, resident.id, 'Rappel automatique', message, 'system');
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing automatic reminders:', error);
    }
  };

  // Run on startup
  processAutomaticReminders();

  // Background job for automatic reminders
  setInterval(processAutomaticReminders, 1000 * 60 * 60 * 24); // Run once a day

  try {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error starting express server:', err);
  }
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
