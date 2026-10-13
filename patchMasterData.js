const fs = require('fs');
let content = fs.readFileSync('src/CharitableTrust.jsx', 'utf-8');

const adminMasterDataRegex = /function AdminMasterData\(\{ C, setC, auth \}\) \{[\s\S]*?(?=function AdminForms)/;

const newAdminMasterData = \unction AdminMasterData({ C, setC, auth }) {
  const [tables, setTables] = useState(C.masterTables || []);
  const [editingTableId, setEditingTableId] = useState(null);
  const [newTableName, setNewTableName] = useState('');
  const [newColName, setNewColName] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);

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
    
    const confirmAddColumn = () => {
      const colName = newColName.trim();
      if(colName && !table.columns.includes(colName)) {
        updateTable({...table, columns: [...table.columns, colName]});
        setNewColName('');
        setShowAddCol(false);
      } else if (table.columns.includes(colName)) {
        alert('Column already exists!');
      }
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

    const handleImportExcel = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const importedRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
          
          if (importedRows.length === 0) {
            alert("No data found in the Excel file.");
            return;
          }
          
          // Extract headers from the first imported row
          const headers = Object.keys(importedRows[0]);
          
          // Merge columns
          const mergedColumns = [...new Set([...table.columns, ...headers])];
          
          // Add rows
          const newRows = importedRows.map(row => {
            const r = { id: 'row_' + Date.now() + Math.random().toString(36).substring(7) };
            mergedColumns.forEach(c => r[c] = row[c] || '');
            return r;
          });
          
          updateTable({...table, columns: mergedColumns, rows: [...table.rows, ...newRows]});
          alert("Successfully imported " + newRows.length + " rows.");
        } catch (err) {
          console.error(err);
          alert("Error parsing Excel file.");
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = null; // reset
    };

    return (
      <div style={{padding:'20px',maxWidth:'1000px',margin:'0 auto'}}>
        <button onClick={()=>setEditingTableId(null)} className="modern-button" style={{marginBottom:15,background:'#64748B',color:'white',padding:'8px 12px',borderRadius:6,border:'none',cursor:'pointer'}}>? Back to Tables</button>
        <h3 style={{fontSize:'1.5rem',marginBottom:20}}>Edit Table: {table.name}</h3>
        
        <div style={{display:'flex',gap:10,marginBottom:20, flexWrap:'wrap', alignItems:'center'}}>
          {!showAddCol ? (
            <button onClick={()=>setShowAddCol(true)} className="modern-button" style={{background:'#1A7A3E',color:'white',padding:'8px 12px',borderRadius:6,border:'none',cursor:'pointer'}}>+ Add Column</button>
          ) : (
            <div style={{display:'flex',gap:6, background:'#F1F5F9', padding:6, borderRadius:6}}>
              <input value={newColName} onChange={e=>setNewColName(e.target.value)} placeholder="New Col Name" style={{padding:'6px',borderRadius:4,border:'1px solid #CBD5E1'}} autoFocus />
              <button onClick={confirmAddColumn} style={{background:'#1A7A3E',color:'white',border:'none',borderRadius:4,padding:'6px 12px',cursor:'pointer'}}>Save</button>
              <button onClick={()=>setShowAddCol(false)} style={{background:'#94A3B8',color:'white',border:'none',borderRadius:4,padding:'6px 12px',cursor:'pointer'}}>Cancel</button>
            </div>
          )}
          
          <button onClick={addRow} className="modern-button" style={{background:'#3B82F6',color:'white',padding:'8px 12px',borderRadius:6,border:'none',cursor:'pointer'}}>+ Add Row</button>
          
          <label style={{background:'#F59E0B',color:'white',padding:'8px 12px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:600,fontSize:'.85rem'}}>
            ?? Upload Excel/CSV
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} style={{display:"none"}}/>
          </label>
        </div>
        
        <div style={{overflowX:'auto',background:'white',borderRadius:8,border:'1px solid #E2E8F0'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead style={{background:'#F8FAFC'}}>
              <tr>
                {table.columns.map(col => (
                  <th key={col} style={{padding:'12px',textAlign:'left',borderBottom:'1px solid #E2E8F0',fontSize:'.9rem',color:'#475569',whiteSpace:'nowrap'}}>
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
                      <input value={row[col] || ''} onChange={(e)=>updateRow(row.id, col, e.target.value)} style={{width:'100%',minWidth:'120px',padding:'6px 8px',borderRadius:4,border:'1px solid #CBD5E1',fontSize:'.85rem'}} />
                    </td>
                  ))}
                  <td style={{padding:'8px 12px',textAlign:'center'}}>
                    <button onClick={()=>deleteRow(row.id)} style={{background:'#EF4444',color:'white',border:'none',borderRadius:4,padding:'6px 12px',cursor:'pointer'}}>Delete</button>
                  </td>
                </tr>
              ))}
              {table.rows.length === 0 && <tr><td colSpan={table.columns.length+1} style={{padding:30,textAlign:'center',color:'#94A3B8'}}>No data yet. Click 'Add Row' or 'Upload Excel' to begin.</td></tr>}
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
        <button onClick={addTable} className="modern-button" style={{background:'#1A7A3E',color:'white',padding:'10px 20px',borderRadius:6,border:'none',cursor:'pointer',fontWeight:600}}>Create Table</button>
      </div>
      <div style={{display:'grid',gap:15}}>
        {tables.map(t => (
          <div key={t.id} style={{background:'white',padding:'15px 20px',borderRadius:8,border:'1px solid #E2E8F0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontWeight:600}}>{t.name}</div><div style={{fontSize:'.85rem',color:'#64748B'}}>{t.columns.length} columns, {t.rows.length} rows</div></div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setEditingTableId(t.id)} className="modern-button" style={{background:'#3B82F6',color:'white',padding:'8px 16px',borderRadius:6,border:'none',cursor:'pointer'}}>Edit Data</button>
              <button onClick={()=>deleteTable(t.id)} style={{background:'#EF4444',color:'white',border:'none',borderRadius:6,padding:'8px 16px',cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
\;

content = content.replace(adminMasterDataRegex, newAdminMasterData + '\\n');
fs.writeFileSync('src/CharitableTrust.jsx', content, 'utf-8');
console.log('AdminMasterData successfully replaced.');
