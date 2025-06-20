import React, { useState } from 'react';
import * as XLSX from 'xlsx';

export default function App() {
  const [inventarioFile, setInventarioFile] = useState(null);
  const [richiestaFile, setRichiestaFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const cleanText = (txt) => (txt ? txt.toString().toLowerCase().trim() : '');

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const matchMarcaModelloAnno = (ricambioInventario, rigaRichiesta) => {
    const marcaReq = cleanText(rigaRichiesta['CAT.'] || rigaRichiesta['Cat.'] || '');
    const modelloReq = cleanText(rigaRichiesta['RICAMBIO'] || rigaRichiesta['Ricambio'] || '');
    const annoReq = cleanText(rigaRichiesta['ANNO'] || '');

    const ricambioInv = cleanText(ricambioInventario);

    if (!marcaReq && !modelloReq) return false;

    const marcaCheck = marcaReq ? ricambioInv.includes(marcaReq) : true;
    const modelloCheck = modelloReq ? ricambioInv.includes(modelloReq) : true;
    const annoCheck = annoReq ? ricambioInv.includes(annoReq) : true;

    return marcaCheck && modelloCheck && annoCheck;
  };

  const handleMatch = async () => {
    if (!inventarioFile || !richiestaFile) {
      alert('Carica entrambi i file Excel prima di procedere.');
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const inventarioData = await readExcelFile(inventarioFile);
      const richiestaData = await readExcelFile(richiestaFile);

      const motoreRichiesta = richiestaData.filter(row => {
        const ricambio = cleanText(row['RICAMBIO'] || row['Ricambio']);
        return ricambio.includes('motore compl') || ricambio.includes('motore completo');
      });

      const results = [];

      motoreRichiesta.forEach(rigaRichiesta => {
        const codMotRichiesta = cleanText(rigaRichiesta['COD MOT'] || rigaRichiesta['Cod Mot'] || '');

        const matchesInventario = inventarioData.filter(rigaInv => {
          const codMotInv = cleanText(rigaInv['Veicolo/Tipo Motore (EcoEuro)'] || '');
          const ricambioInv = cleanText(rigaInv['Ricambio'] || '');

          if (codMotInv !== codMotRichiesta) return false;
          if (!ricambioInv.includes('motore compl') && !ricambioInv.includes('motore semicompl')) return false;

          if (!matchMarcaModelloAnno(rigaInv['Ricambio'] || '', rigaRichiesta)) return false;

          return true;
        });

        results.push({
          richiesta: rigaRichiesta,
          inventarioMatches: matchesInventario
        });
      });

      setResult(results);
    } catch (err) {
      alert('Errore nel caricamento o elaborazione dei file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderResults = () => {
    if (!result || result.length === 0) {
      return <p>Nessun risultato trovato.</p>;
    }

    return result.map((res, i) => (
      <div key={i} style={{ marginBottom: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
        <h3>Richiesta Motore: {res.richiesta['COD MOT']}</h3>
        <p><b>Ricambio Richiesto:</b> {res.richiesta['RICAMBIO']}</p>
        <p><b>Marca/Modello/Anno Richiesta:</b> {`${res.richiesta['CAT.'] || ''} / ${res.richiesta['RICAMBIO'] || ''} / ${res.richiesta['ANNO'] || ''}`}</p>
        <p><b>Match Inventario trovato:</b> {res.inventarioMatches.length}</p>
        {res.inventarioMatches.length > 0 && (
          <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse', width: '100%', marginTop: '0.5rem' }}>
            <thead>
              <tr>
                {Object.keys(res.inventarioMatches[0]).map((col, idx) => (
                  <th key={idx}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {res.inventarioMatches.map((row, ridx) => (
                <tr key={ridx}>
                  {Object.values(row).map((val, cidx) => (
                    <td key={cidx}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    ));
  };

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>match-facile: Matching Motori Inventario vs Richiesta</h1>

      <div style={{ marginBottom: '1rem' }}>
        <label><b>Carica file Inventario.xlsx:</b></label><br />
        <input type="file" accept=".xlsx,.xls" onChange={e => setInventarioFile(e.target.files[0])} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label><b>Carica file Richiesta.xlsx:</b></label><br />
        <input type="file" accept=".xlsx,.xls" onChange={e => setRichiestaFile(e.target.files[0])} />
      </div>

      <button onClick={handleMatch} disabled={loading} style={{ padding: '0.6rem 1.2rem', fontSize: '1rem' }}>
        {loading ? 'Caricamento...' : 'Esegui Matching'}
      </button>

      <hr style={{ margin: '2rem 0' }} />

      <div>
        {renderResults()}
      </div>

      <footer style={{ textAlign: 'center', marginTop: '3rem', fontSize: '0.9rem', color: '#555' }}>
        <p>match-facile © 2025</p>
      </footer>
    </div>
  );
}
