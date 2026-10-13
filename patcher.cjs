const fs = require('fs');
let content = fs.readFileSync('src/CharitableTrust.jsx', 'utf-8');

// 1. Helpers
const helpers = \
export const getMasterDataOptions = (optsString, config) => {
  if (!optsString || typeof optsString !== 'string' || !optsString.startsWith("@master:")) {
    return (optsString || "").split(",").map(s => s.trim()).filter(Boolean);
  }
  const parts = optsString.split(":");
  if (parts.length < 3) return [];
  const tableId = parts[1];
  const colName = parts.slice(2).join(":");
  const table = config?.masterTables?.find(t => t.id === tableId);
  if (!table) return [];
  return [...new Set(table.rows.map(r => r[colName]).filter(Boolean))];
};

export const getMasterDataAutoPopulate = (optsString, selectedValue, config) => {
  if (!optsString || typeof optsString !== 'string' || !optsString.startsWith("@master:")) return null;
  const parts = optsString.split(":");
  if (parts.length < 3) return null;
  const tableId = parts[1];
  const colName = parts.slice(2).join(":");
  const table = config?.masterTables?.find(t => t.id === tableId);
  if (!table) return null;
  const row = table.rows.find(r => r[colName] === selectedValue);
  if (!row) return null;
  const result = {};
  for (const [k, v] of Object.entries(row)) {
    if (k !== 'id' && k !== colName) result[k] = v;
  }
  return result;
};
\;
content = content.replace('export const extractVibhagList = (config) => {', helpers + '\\nexport const extractVibhagList = (config) => {');

// 2. ANAV
content = content.replace('{id:"access",icon:"??",label:"Access Control"},', '{id:"access",icon:"??",label:"Access Control"},\\n  {id:"masterdata",icon:"???",label:"Master Data"},');

// 3. hasAccess
content = content.replace('"access", "backup", "profile", "meritlist", "inviteletters", "certificates"]', '"access", "masterdata", "backup", "profile", "meritlist", "inviteletters", "certificates"]');

// 4. Admin route
content = content.replace('{tab==="access"    && hasAccess.includes("access") && <AdminAccess C={C} setC={setC} master={master} auth={auth}/>}', '{tab==="access"    && hasAccess.includes("access") && <AdminAccess C={C} setC={setC} master={master} auth={auth}/>}\\n          {tab==="masterdata" && hasAccess.includes("masterdata") && <AdminMasterData C={C} setC={setC} auth={auth} />}');

// 5. AdminMasterData component
const adminMasterData = \
function AdminMasterData({ C, setC, auth }) {
  const [tables, setTables] = useState(C.masterTables || []);
  const [editingTableId, setEditingTableId] = useState(null);
  const [newTableName, setNewTableName] = useState('');

  const save = (newTables) => {
    setTables(newTables);
    setC({...C, masterTables: newTables});
  };

  const addTable = () => {
    if(!newTableName.trim()) return;
    const nt = { id: 'table_' + Date.now(), name: newTableName.trim(), columns: ['Name'], rows: [] };
    save([...tables, nt]);
    setNewTableName('');
  };

  const deleteTable = (id) => {
    if(window.confirm('Delete this master table?')) save(tables.filter(t => t.id !== id));
  };

  if(editingTableId) {
    const table = tables.find(t => t.id === editingTableId);
    if(!table) return null;
    const updateTable = (updated) => save(tables.map(t => t.id === editingTableId ? updated : t));
    const addColumn = () => {
      const colName = window.prompt('New Column Name:');
      if(colName && !table.columns.includes(colName)) updateTable({...table, columns: [...table.columns, colName]});
    };
    const deleteColumn = (col) => {
      if(table.columns.length <= 1) return alert('At least one column is required.');
      if(window.confirm('Delete column ' + col + '? Data will be lost.')) {
        updateTable({...table, columns: table.columns.filter(c => c !== col), rows: table.rows.map(r => { const nr = {...r}; delete nr[col]; return nr; })});
      }
    };
    const addRow = () => {
      const newRow = { id: 'row_' + Date.now() };
      table.columns.forEach(c => newRow[c] = '');
      updateTable({...table, rows: [...table.rows, newRow]});
    };
    const updateRow = (rowId, col, val) => updateTable({...table, rows: table.rows.map(r => r.id === rowId ? { ...r, [col]: val } : r)});
    const deleteRow = (rowId) => { if(window.confirm('Delete this row?')) updateTable({...table, rows: table.rows.filter(r => r.id !== rowId)}); };

    return (
      <div style={{padding:'20px',maxWidth:'1000px',margin:'0 auto'}}>
        <button onClick={()=>setEditingTableId(null)} className="modern-button" style={{marginBottom:15,background:'#64748B'}}>Back to Tables</button>
        <h3 style={{fontSize:'1.5rem',marginBottom:20}}>Edit Table: {table.name}</h3>
        <div style={{display:'flex',gap:10,marginBottom:20}}>
          <button onClick={addColumn} className="modern-button">Add Column</button>
          <button onClick={addRow} className="modern-button">Add Row</button>
        </div>
        <div style={{overflowX:'auto',background:'white',borderRadius:8,border:'1px solid #E2E8F0'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead style={{background:'#F8FAFC'}}>
              <tr>
                {table.columns.map(col => (
                  <th key={col} style={{padding:'12px',textAlign:'left',borderBottom:'1px solid #E2E8F0',fontSize:'.9rem',color:'#475569'}}>
                    {col} {table.columns.length > 1 && <span style={{cursor:'pointer',color:'red',marginLeft:8,fontSize:'12px'}} onClick={()=>deleteColumn(col)}>×</span>}
                  </th>
                ))}
                <th style={{padding:'12px',width:'60px',borderBottom:'1px solid #E2E8F0'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(row => (
                <tr key={row.id} style={{borderBottom:'1px solid #F1F5F9'}}>
                  {table.columns.map(col => (
                    <td key={col} style={{padding:'8px 12px'}}>
                      <input value={row[col] || ''} onChange={(e)=>updateRow(row.id, col, e.target.value)} style={{width:'100%',padding:'6px 8px',borderRadius:4,border:'1px solid #CBD5E1',fontSize:'.85rem'}} />
                    </td>
                  ))}
                  <td style={{padding:'8px 12px',textAlign:'center'}}>
                    <button onClick={()=>deleteRow(row.id)} style={{background:'red',color:'white',border:'none',borderRadius:4,padding:'4px 8px',cursor:'pointer'}}>Del</button>
                  </td>
                </tr>
              ))}
              {table.rows.length === 0 && <tr><td colSpan={table.columns.length+1} style={{padding:20,textAlign:'center',color:'#94A3B8'}}>No rows yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:'20px',maxWidth:'800px',margin:'0 auto'}}>
      <h2 style={{fontSize:'1.5rem',marginBottom:20,color:'#1E293B',fontWeight:700}}>Master Data Tables</h2>
      <div style={{display:'flex',gap:10,marginBottom:30,background:'#F8FAFC',padding:15,borderRadius:8,border:'1px solid #E2E8F0'}}>
        <input placeholder="New Table Name" value={newTableName} onChange={e=>setNewTableName(e.target.value)} style={{flex:1,padding:'10px',borderRadius:6,border:'1px solid #CBD5E1',fontSize:'.9rem'}} />
        <button onClick={addTable} className="modern-button">Create Table</button>
      </div>
      <div style={{display:'grid',gap:15}}>
        {tables.map(t => (
          <div key={t.id} style={{background:'white',padding:'15px 20px',borderRadius:8,border:'1px solid #E2E8F0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontWeight:600}}>{t.name}</div><div style={{fontSize:'.85rem'}}>{t.columns.length} columns, {t.rows.length} rows</div></div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setEditingTableId(t.id)} className="modern-button" style={{background:'#3B82F6',padding:'6px 12px'}}>Edit Data</button>
              <button onClick={()=>deleteTable(t.id)} style={{background:'#EF4444',color:'white',border:'none',borderRadius:6,padding:'6px 12px',cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
\;
content = content.replace('function AdminForms({ C, setC, saveToFb, mob, auth }) {', adminMasterData + '\\nfunction AdminForms({ C, setC, saveToFb, mob, auth }) {');

// 6. AdminForms options replacements
const replacement1 = \
                                  <div style={{flex:1, display:"flex", gap:4}}>
                                    <input value={field.options||""} onChange={e => { const newF=[...editingForm.fields]; newF[fieldIdx].options=e.target.value; updateCurrentForm({...editingForm, fields:newF}); }} placeholder="Options (csv) or @master:id:col" style={{flex:1, padding:4, border:"1px solid var(--bd)", borderRadius:4, fontSize:".75rem"}}/>
                                    {C.masterTables?.length > 0 && (
                                      <select style={{maxWidth:"100px", padding:4, border:"1px solid var(--bd)", borderRadius:4, fontSize:".75rem", background:"white"}} onChange={e => {
                                        if(e.target.value) {
                                          const newF=[...editingForm.fields]; 
                                          newF[fieldIdx].options=e.target.value; 
                                          updateCurrentForm({...editingForm, fields:newF});
                                        }
                                      }}>
                                        <option value="">Link Master</option>
                                        {C.masterTables.map(mt => mt.columns.map(col => (
                                          <option key={\\\\\\:\\\\\\} value={\\\@master:\\\:\\\\\\}>{mt.name} - {col}</option>
                                        )))}
                                      </select>
                                    )}
                                  </div>
\;

content = content.replace('<input value={field.options||""} onChange={e => { const newF=[...editingForm.fields]; newF[fieldIdx].options=e.target.value; updateCurrentForm({...editingForm, fields:newF}); }} placeholder="Options (comma separated)" style={{flex:1, padding:4, border:"1px solid var(--bd)", borderRadius:4, fontSize:".75rem"}}/>', replacement1);

const replacement2 = \
                          <div style={{flex:1, display:"flex", gap:4}}>
                            <input value={newLibOptions} onChange={e => setNewLibOptions(e.target.value)} placeholder="Options (csv) or @master:id:col" style={{flex:1,padding:"6px",fontSize:".8rem",border:"1px solid var(--bd)",borderRadius:4}}/>
                            {C.masterTables?.length > 0 && (
                              <select style={{maxWidth:"120px", padding:4, border:"1px solid var(--bd)", borderRadius:4, fontSize:".75rem", background:"white"}} onChange={e => {
                                if(e.target.value) setNewLibOptions(e.target.value);
                              }}>
                                <option value="">Link Master</option>
                                {C.masterTables.map(mt => mt.columns.map(col => (
                                  <option key={\\\\\\:\\\\\\} value={\\\@master:\\\:\\\\\\}>{mt.name} - {col}</option>
                                )))}
                              </select>
                            )}
                          </div>
\;
content = content.replace('<input value={newLibOptions} onChange={e => setNewLibOptions(e.target.value)} placeholder="Options (comma separated)" style={{flex:1,padding:"6px",fontSize:".8rem",border:"1px solid var(--bd)",borderRadius:4}}/>', replacement2);

// 7. Update getMasterDataOptions for rendering
content = content.replace(/options=\{\(f\.options \|\| ""\)\.split\("\,"\)\.map\(s => s\.trim\(\)\)\.filter\(Boolean\)\}/g, 'options={getMasterDataOptions(f.options, C)}');

// Dropdowns in Registration & Profile
const search1 = 'onChange={e => setFormData(prev => ({ ...prev, [fKey]: e.target.value }))}';
const rep1 = \onChange={e => {
                          const val = e.target.value;
                          const autoPopulate = getMasterDataAutoPopulate(f.options, val, C) || {};
                          setFormData(prev => ({...prev, [fKey]: val, ...autoPopulate}));
                        }}\;
content = content.split(search1).join(rep1);

const search2 = 'onChange={e => {\\n                            setFormData(prev => ({...prev, [fKey]:e.target.value}));\\n                            if (isError && e.target.value) setValidationErrors(prev => prev.filter(k => k !== fKey));\\n                          }}';
const rep2 = \onChange={e => {
                          const val = e.target.value;
                          const autoPopulate = getMasterDataAutoPopulate(f.options, val, C) || {};
                          setFormData(prev => ({...prev, [fKey]:val, ...autoPopulate}));
                          if (isError && val) setValidationErrors(prev => prev.filter(k => k !== fKey));
                        }}\;
content = content.split(search2).join(rep2);

const search3 = 'onChange={e => setEditedReg(prev => ({ ...prev, [f.key]: e.target.value }))}';
const rep3 = \onChange={e => {
                                const val = e.target.value;
                                const autoPopulate = getMasterDataAutoPopulate(f.options, val, C) || {};
                                setEditedReg(prev => ({ ...prev, [f.key]: val, ...autoPopulate }));
                              }}\;
content = content.split(search3).join(rep3);

const search4 = 'onChange={e => setEditedReg(p => ({ ...p, [f.key]: e.target.value }))}';
const rep4 = \onChange={e => {
                                const val = e.target.value;
                                const autoPopulate = getMasterDataAutoPopulate(f.options, val, C) || {};
                                setEditedReg(p => ({ ...p, [f.key]: val, ...autoPopulate }));
                            }}\;
content = content.split(search4).join(rep4);

fs.writeFileSync('src/CharitableTrust.jsx', content, 'utf-8');
console.log("Patched successfully");
