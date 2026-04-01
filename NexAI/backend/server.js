const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({ 
  origin: [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "https://nexaireferraltracking1-pivpwr485-peterpaker7s-projects.vercel.app/"  // ← Your Vercel URL
  ], 
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], 
  credentials: true 
}));
app.use(express.json());

// Database connection with better error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

// Test database connection without crashing the app
if (process.env.DATABASE_URL) {
  pool.connect((err, client, release) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
    } else {
      console.log('✅ Database connected successfully');
      release();
    }
  });
} else {
  console.warn('⚠️  DATABASE_URL not set - app will run without database');
}

// Root endpoint - shows API status
app.get('/', (req, res) => {
  res.json({
    name: 'NexAI Backend API',
    version: 'v5',
    status: 'running',
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    endpoints: {
      health: '/health',
      stats: '/dashboard/stats',
      patients: '/patients'
    },
    time: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NexAI v5',
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    timestamp: new Date().toISOString()
  });
});

// ════════════════════════════════
// RISK ENGINE — pure function, no DB storage
// ════════════════════════════════
function calcRisk(patient, latestVisit) {
  const reasons = [];

  // BP check
  if (latestVisit && latestVisit.systolic_bp > 140)
    reasons.push({ factor:"BP", detail:`${latestVisit.systolic_bp}/${latestVisit.diastolic_bp} mmHg (Systolic high)`, severity:"HIGH" });
  else if (latestVisit && latestVisit.diastolic_bp > 90)
    reasons.push({ factor:"BP", detail:`${latestVisit.systolic_bp}/${latestVisit.diastolic_bp} mmHg (Diastolic high)`, severity:"HIGH" });

  // Hb check
  if (latestVisit && latestVisit.hb !== null && parseFloat(latestVisit.hb) < 10)
    reasons.push({ factor:"Hb", detail:`${latestVisit.hb} g/dL (Anaemia)`, severity: parseFloat(latestVisit.hb) < 7 ? "HIGH" : "MEDIUM" });

  // Age check
  if (patient.age < 18)
    reasons.push({ factor:"Age", detail:`${patient.age} years (Under 18)`, severity:"HIGH" });
  else if (patient.age > 35)
    reasons.push({ factor:"Age", detail:`${patient.age} years (Over 35)`, severity:"MEDIUM" });

  // Gravida check
  if (patient.gravida >= 3)
    reasons.push({ factor:"Gravida", detail:`G${patient.gravida} (High parity)`, severity:"MEDIUM" });

  const isHighRisk = reasons.length > 0;
  const priority = reasons.some(r => r.severity === "HIGH") ? "HIGH"
    : reasons.length > 0 ? "MEDIUM" : "LOW";

  return { is_high_risk: isHighRisk, reasons, priority };
}

// ════════════════════════════════
// HELPERS
// ════════════════════════════════
function calcEDD(lmp) { const d=new Date(lmp); d.setDate(d.getDate()+280); return d.toISOString().split('T')[0]; }
async function genCode(client) {
  const r=await client.query('SELECT patient_code FROM patients ORDER BY id DESC LIMIT 1');
  if(!r.rows.length) return 'NX-000001';
  return 'NX-'+String(parseInt(r.rows[0].patient_code.replace('NX-',''),10)+1).padStart(6,'0');
}

// ════════════════════════════════
// PATIENTS
// ════════════════════════════════
app.post('/patients',[
  body('name').trim().notEmpty(),
  body('age').isInt({min:10,max:60}),
  body('phone').matches(/^[6-9]\d{9}$/),
  body('lmp').isDate(),
],async(req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({success:false,errors:errors.array()});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {name,age,phone,gravida=1,lmp,address,blood_group}=req.body;
    // Duplicate phone check
    const existing=await client.query('SELECT id,name,patient_code FROM patients WHERE phone=$1',[phone]);
    if(existing.rows.length>0) {
      await client.query('ROLLBACK');
      return res.status(409).json({success:false,message:`Phone already registered under ${existing.rows[0].name} (${existing.rows[0].patient_code})`});
    }
    const edd=calcEDD(lmp), patient_code=await genCode(client);
    const result=await client.query(
      'INSERT INTO patients (patient_code,name,age,phone,gravida,lmp,edd,address,blood_group) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [patient_code,name.trim(),age,phone,gravida,lmp,edd,address||null,blood_group||null]
    );
    await client.query('COMMIT');
    res.status(201).json({success:true,patient:result.rows[0]});
  } catch(err){ await client.query('ROLLBACK'); res.status(500).json({success:false,message:'Server error'}); }
  finally{ client.release(); }
});

app.get('/patients',async(req,res)=>{
  const {search}=req.query;
  try {
    const q=search
      ?'SELECT id,patient_code,name,phone,age,edd,lmp,gravida,address,blood_group FROM patients WHERE phone ILIKE $1 OR patient_code ILIKE $1 OR LOWER(name) LIKE LOWER($1) ORDER BY created_at DESC LIMIT 20'
      :'SELECT id,patient_code,name,phone,age,edd,lmp,gravida,address,blood_group FROM patients ORDER BY created_at DESC LIMIT 20';
    const result=search?await pool.query(q,[`%${search}%`]):await pool.query(q);
    res.json({success:true,patients:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

app.get('/patients/:id',async(req,res)=>{
  try {
    const result=await pool.query('SELECT * FROM patients WHERE id=$1',[req.params.id]);
    if(!result.rows.length) return res.status(404).json({success:false,message:'Not found'});
    res.json({success:true,patient:result.rows[0]});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

app.delete('/patients/:id',async(req,res)=>{
  try {
    const result=await pool.query('DELETE FROM patients WHERE id=$1 RETURNING *',[req.params.id]);
    if(!result.rows.length) return res.status(404).json({success:false,message:'Not found'});
    res.json({success:true,patient:result.rows[0]});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

app.post('/patients/restore',async(req,res)=>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const p=req.body;
    const result=await client.query(
      'INSERT INTO patients (id,patient_code,name,age,phone,gravida,lmp,edd,address,blood_group,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name RETURNING *',
      [p.id,p.patient_code,p.name,p.age,p.phone,p.gravida,p.lmp,p.edd,p.address||null,p.blood_group||null,p.created_at]
    );
    await client.query('COMMIT');
    res.json({success:true,patient:result.rows[0]});
  } catch(err){ await client.query('ROLLBACK'); res.status(500).json({success:false,message:'Server error'}); }
  finally{ client.release(); }
});

// ════════════════════════════════
// VISITS
// ════════════════════════════════
app.post('/visits',[
  body('patient_id').isInt(),
  body('systolic_bp').isInt({min:60,max:250}),
  body('diastolic_bp').isInt({min:40,max:150}),
  body('hb').optional({nullable:true}).isFloat({min:1,max:20}),
  body('weight').optional({nullable:true}).isFloat({min:20,max:200}),
],async(req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({success:false,errors:errors.array()});
  const {patient_id,systolic_bp,diastolic_bp,hb,weight,notes,visit_date}=req.body;
  try {
    // Fetch patient for risk calc
    const p=await pool.query('SELECT * FROM patients WHERE id=$1',[patient_id]);
    if(!p.rows.length) return res.status(404).json({success:false,message:'Patient not found'});
    const patient=p.rows[0];
    const visitData={systolic_bp,diastolic_bp,hb:hb||null};
    const risk=calcRisk(patient,visitData);
    const result=await pool.query(
      'INSERT INTO visits (patient_id,visit_date,systolic_bp,diastolic_bp,hb,weight,notes,is_high_risk) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [patient_id,visit_date||new Date().toISOString().split('T')[0],systolic_bp,diastolic_bp,hb||null,weight||null,notes||null,risk.is_high_risk]
    );
    res.status(201).json({success:true,visit:result.rows[0],is_high_risk:risk.is_high_risk,risk_reasons:risk.reasons});
  } catch(err){ console.error(err); res.status(500).json({success:false,message:'Server error'}); }
});

app.get('/visits/:patient_id',async(req,res)=>{
  try {
    const result=await pool.query('SELECT * FROM visits WHERE patient_id=$1 ORDER BY visit_date DESC, created_at DESC',[req.params.patient_id]);
    res.json({success:true,visits:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// PATCH /visits/:id/verify
app.patch('/visits/:id/verify',[
  body('verified_by').trim().notEmpty().withMessage('Doctor name required'),
],async(req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({success:false,errors:errors.array()});
  try {
    const result=await pool.query(
      'UPDATE visits SET is_verified=TRUE, verified_by=$1 WHERE id=$2 RETURNING *',
      [req.body.verified_by, req.params.id]
    );
    if(!result.rows.length) return res.status(404).json({success:false,message:'Visit not found'});
    res.json({success:true,visit:result.rows[0]});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// ════════════════════════════════
// REFERRALS
// ════════════════════════════════
app.post('/referrals',[
  body('patient_id').isInt(),
  body('referred_to').trim().notEmpty(),
  body('reason').trim().notEmpty(),
  body('priority').optional().isIn(['HIGH','MEDIUM','LOW']),
],async(req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({success:false,errors:errors.array()});
  const {patient_id,visit_id,referred_to,reason,notes,priority='MEDIUM'}=req.body;
  try {
    const p=await pool.query('SELECT * FROM patients WHERE id=$1',[patient_id]);
    if(!p.rows.length) return res.status(404).json({success:false,message:'Patient not found'});
    const result=await pool.query(
      'INSERT INTO referrals (patient_id,visit_id,referred_to,reason,notes,priority) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [patient_id,visit_id||null,referred_to.trim(),reason.trim(),notes||null,priority]
    );
    res.status(201).json({success:true,referral:result.rows[0]});
  } catch(err){ console.error(err); res.status(500).json({success:false,message:'Server error'}); }
});

app.get('/referrals/:patient_id',async(req,res)=>{
  try {
    const result=await pool.query(
      'SELECT *, CURRENT_DATE - referral_date AS days_pending FROM referrals WHERE patient_id=$1 ORDER BY referral_date DESC, created_at DESC',
      [req.params.patient_id]
    );
    res.json({success:true,referrals:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

app.patch('/referrals/:id/status',[
  body('status').isIn(['ARRIVED','NOT_ARRIVED']),
],async(req,res)=>{
  const errors=validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({success:false,errors:errors.array()});
  try {
    const result=await pool.query('UPDATE referrals SET status=$1 WHERE id=$2 RETURNING *',[req.body.status,req.params.id]);
    if(!result.rows.length) return res.status(404).json({success:false,message:'Not found'});
    res.json({success:true,referral:result.rows[0]});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// ════════════════════════════════
// DASHBOARD — v5 enhanced
// ════════════════════════════════

// High risk with multi-factor reasons
app.get('/dashboard/high-risk',async(req,res)=>{
  try {
    const result=await pool.query(`
      SELECT DISTINCT ON (p.id)
        p.id, p.name, p.patient_code, p.phone, p.age, p.gravida,
        p.edd, p.lmp, p.address, p.blood_group,
        v.id as visit_id, v.systolic_bp, v.diastolic_bp, v.hb, v.visit_date, v.is_verified
      FROM patients p
      JOIN visits v ON v.patient_id=p.id
      WHERE v.systolic_bp > 140 OR v.diastolic_bp > 90
         OR (v.hb IS NOT NULL AND v.hb < 10)
         OR p.age < 18 OR p.age > 35
         OR p.gravida >= 3
      ORDER BY p.id, v.visit_date DESC
    `);
    // Add reasons for each patient
    const patients = result.rows.map(row => {
      const risk = calcRisk(
        { age: row.age, gravida: row.gravida },
        { systolic_bp: row.systolic_bp, diastolic_bp: row.diastolic_bp, hb: row.hb }
      );
      return { ...row, risk_reasons: risk.reasons, priority: risk.priority };
    });
    res.json({success:true, patients});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// Delayed referrals (>2 days pending)
app.get('/dashboard/delayed-referrals',async(req,res)=>{
  try {
    const result=await pool.query(`
      SELECT r.*, p.name, p.patient_code, p.phone, p.age, p.edd, p.lmp, p.gravida, p.address, p.blood_group,
             p.id as patient_id_val,
             CURRENT_DATE - r.referral_date AS days_pending
      FROM referrals r
      JOIN patients p ON r.patient_id=p.id
      WHERE r.status='PENDING'
        AND CURRENT_DATE - r.referral_date > 2
      ORDER BY r.referral_date ASC
    `);
    res.json({success:true, referrals:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// High priority referrals
app.get('/dashboard/high-priority',async(req,res)=>{
  try {
    const result=await pool.query(`
      SELECT r.*, p.name, p.patient_code, p.phone, p.age, p.edd, p.lmp, p.gravida, p.address, p.blood_group,
             CURRENT_DATE - r.referral_date AS days_pending
      FROM referrals r
      JOIN patients p ON r.patient_id=p.id
      WHERE r.priority='HIGH' AND r.status='PENDING'
      ORDER BY r.referral_date ASC
    `);
    res.json({success:true, referrals:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// Unverified visits (last 7 days)
app.get('/dashboard/unverified-visits',async(req,res)=>{
  try {
    const result=await pool.query(`
      SELECT v.*, p.name, p.patient_code, p.age, p.gravida, p.lmp, p.edd, p.phone, p.address, p.blood_group,
             p.id as patient_id_val
      FROM visits v
      JOIN patients p ON v.patient_id=p.id
      WHERE v.is_verified=FALSE
        AND v.visit_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY v.visit_date DESC
    `);
    res.json({success:true, visits:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// Pending referrals (existing)
app.get('/dashboard/pending-referrals',async(req,res)=>{
  try {
    const result=await pool.query(`
      SELECT r.*, p.id as patient_id_val, p.name, p.patient_code, p.phone, p.age, p.edd, p.lmp, p.gravida, p.address, p.blood_group,
             CURRENT_DATE - r.referral_date AS days_pending
      FROM referrals r JOIN patients p ON r.patient_id=p.id
      WHERE r.status='PENDING' ORDER BY r.referral_date ASC
    `);
    res.json({success:true, referrals:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// Due soon
app.get('/dashboard/due-soon',async(req,res)=>{
  try {
    const result=await pool.query(`SELECT id,name,patient_code,phone,edd,age,lmp,gravida,address,blood_group FROM patients WHERE edd BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '14 days' ORDER BY edd ASC`);
    res.json({success:true, patients:result.rows});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// Stats
app.get('/dashboard/stats',async(req,res)=>{
  try {
    const [total,highRisk,dueSoon,totalVisits,pendingRef,unverified,delayed] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM patients'),
      pool.query(`SELECT COUNT(DISTINCT p.id) FROM patients p JOIN visits v ON v.patient_id=p.id WHERE v.systolic_bp>140 OR v.diastolic_bp>90 OR (v.hb IS NOT NULL AND v.hb<10) OR p.age<18 OR p.age>35 OR p.gravida>=3`),
      pool.query(`SELECT COUNT(*) FROM patients WHERE edd BETWEEN CURRENT_DATE AND CURRENT_DATE+INTERVAL '14 days'`),
      pool.query('SELECT COUNT(*) FROM visits'),
      pool.query(`SELECT COUNT(*) FROM referrals WHERE status='PENDING'`),
      pool.query(`SELECT COUNT(*) FROM visits WHERE is_verified=FALSE AND visit_date>=CURRENT_DATE-INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*) FROM referrals WHERE status='PENDING' AND CURRENT_DATE-referral_date>2`),
    ]);
    res.json({success:true, stats:{
      total:parseInt(total.rows[0].count),
      high_risk:parseInt(highRisk.rows[0].count),
      due_soon:parseInt(dueSoon.rows[0].count),
      total_visits:parseInt(totalVisits.rows[0].count),
      pending_referrals:parseInt(pendingRef.rows[0].count),
      unverified_visits:parseInt(unverified.rows[0].count),
      delayed_referrals:parseInt(delayed.rows[0].count),
    }});
  } catch(err){ res.status(500).json({success:false,message:'Server error'}); }
});

// ============================================
// START SERVER - ADD THIS AT THE VERY END
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NexAI Backend v5 running on port ${PORT}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Configured ✓' : 'Missing ✗'}`);
});
