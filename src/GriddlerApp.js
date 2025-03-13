import React, { useState, useEffect, useRef } from 'react';
import './GriddlerApp.css'; // Ensure your CSS is imported

// File storage utility for backup/restore/import operations
const PuzzleFileStorage = {
  savePuzzlesToFile: (puzzles) => {
    try {
      const puzzlesJson = JSON.stringify(puzzles, null, 2);
      const blob = new Blob([puzzlesJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'griddler-puzzles.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Error saving puzzles to file:", error);
      return false;
    }
  },
  loadPuzzlesFromFile: () => {
    return new Promise((resolve, reject) => {
      try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (event) => {
          const file = event.target.files[0];
          if (!file) {
            resolve(null);
            return;
          }
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const puzzles = JSON.parse(e.target.result);
              resolve(puzzles);
            } catch (error) {
              console.error("Error parsing puzzles file:", error);
              reject(error);
            }
          };
          reader.onerror = (error) => {
            console.error("Error reading file:", error);
            reject(error);
          };
          reader.readAsText(file);
        };
        fileInput.click();
      } catch (error) {
        console.error("Error loading puzzles from file:", error);
        reject(error);
      }
    });
  }
};


// Utility functions
const computeClues = (grid) => {
  const rows = [];
  const cols = [];
  for (let i = 0; i < grid.length; i++) {
    let count = 0;
    const rowClues = [];
    for (let j = 0; j < grid[i].length; j++) {
      if (grid[i][j] === 1) {
        count++;
      } else if (count > 0) {
        rowClues.push(count);
        count = 0;
      }
    }
    if (count > 0) rowClues.push(count);
    rows.push(rowClues.length ? rowClues : [0]);
  }
  for (let j = 0; j < grid[0].length; j++) {
    let count = 0;
    const colClues = [];
    for (let i = 0; i < grid.length; i++) {
      if (grid[i][j] === 1) {
        count++;
      } else if (count > 0) {
        colClues.push(count);
        count = 0;
      }
    }
    if (count > 0) colClues.push(count);
    cols.push(colClues.length ? colClues : [0]);
  }
  return { rows, cols };
};

const createEmptyGrid = (size) =>
  Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));

const GriddlerApp = () => {
  // State setup
  const [puzzles, setPuzzles] = useState([]);
  const [selectedPuzzle, setSelectedPuzzle] = useState(null);
  const [gridState, setGridState] = useState([]);
  const [message, setMessage] = useState('');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [currentDrawMode, setCurrentDrawMode] = useState(null);
  const [activeTab, setActiveTab] = useState('solve'); // 'solve' or 'create'
  const [creatorGridSize, setCreatorGridSize] = useState(10);
  const [creatorGrid, setCreatorGrid] = useState(createEmptyGrid(10));
  const [creatorName, setCreatorName] = useState('New Puzzle');
  const [editMode, setEditMode] = useState(false);
  const [editingPuzzleId, setEditingPuzzleId] = useState(null);
  const [theme, setTheme] = useState('blue');
  const gridRef = useRef(null);

  // On first load, load puzzles from localStorage if they exist; otherwise, fetch from the JSON file
  useEffect(() => {
    const saved = localStorage.getItem('griddlerPuzzles');
    if (saved) {
      setPuzzles(JSON.parse(saved));
    } else {
      // Ensure that griddler-puzzles4.json is placed in your public folder so it can be fetched.
      fetch('${process.env.PUBLIC_URL}/griddler-puzzles4.json')
        .then((res) => res.json())
        .then((data) => {
          setPuzzles(data);
          localStorage.setItem('griddlerPuzzles', JSON.stringify(data));
        })
        .catch((err) => console.error('Error loading puzzles:', err));
    }
  }, []);
  // When a puzzle is selected for the first time, initialize grid state accordingly
  useEffect(() => {
    if (puzzles.length && !selectedPuzzle) {
      setSelectedPuzzle(puzzles[0]);
      setGridState(JSON.parse(JSON.stringify(puzzles[0].grid)));
    }
  }, [puzzles, selectedPuzzle]);

  // Persist puzzles in localStorage
  useEffect(() => {
    localStorage.setItem('griddlerPuzzles', JSON.stringify(puzzles));
  }, [puzzles]);

  // Global mouseup to stop dragging
  useEffect(() => {
    const handleMouseUp = () => {
      setIsMouseDown(false);
      setCurrentDrawMode(null);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // When switching puzzles in solve mode, reset the grid state
  useEffect(() => {
    if (activeTab === 'solve' && selectedPuzzle) {
      setGridState(createEmptyGrid(selectedPuzzle.grid.length));
    }
  }, [selectedPuzzle, activeTab]);

  const getMaxClueWidth = (clues) => {
    if (!clues || !clues.length) return 0;
    return Math.max(...clues.map(row => row.length));
  };

  // Handlers
  const handleSelectPuzzle = (puzzle) => {
    setSelectedPuzzle(puzzle);
    if (activeTab === 'solve') {
      setGridState(createEmptyGrid(puzzle.grid.length));
      setMessage('');
    } else if (activeTab === 'create') {
      setCreatorGrid(JSON.parse(JSON.stringify(puzzle.grid)));
      setCreatorName(puzzle.name);
      setCreatorGridSize(parseInt(puzzle.size.split('x')[0], 10));
      setEditMode(true);
      setEditingPuzzleId(puzzle.id);
    }
  };

  const handleCellInteraction = (rowIndex, colIndex, isRightClick, isSolveMode = true) => {
    if (isSolveMode) {
      const newGrid = [...gridState];
      let newCellState;
      if (isRightClick) {
        newCellState = newGrid[rowIndex][colIndex] === 2 ? 0 : 2;
      } else {
        newCellState = newGrid[rowIndex][colIndex] === 1 ? 0 : 1;
      }
      newGrid[rowIndex][colIndex] = newCellState;
      setGridState(newGrid);
      return newCellState;
    } else {
      const newGrid = [...creatorGrid];
      const newCellState = newGrid[rowIndex][colIndex] === 1 ? 0 : 1;
      newGrid[rowIndex][colIndex] = newCellState;
      setCreatorGrid(newGrid);
      return newCellState;
    }
  };

  const handleMouseDown = (rowIndex, colIndex, isRightClick, isSolveMode = true) => {
    setIsMouseDown(true);
    const newState = handleCellInteraction(rowIndex, colIndex, isRightClick, isSolveMode);
    setCurrentDrawMode(newState);
  };

  const handleMouseEnter = (rowIndex, colIndex, isSolveMode = true) => {
    if (isMouseDown && currentDrawMode !== null) {
      if (isSolveMode) {
        const newGrid = [...gridState];
        newGrid[rowIndex][colIndex] = currentDrawMode;
        setGridState(newGrid);
      } else {
        const newGrid = [...creatorGrid];
        newGrid[rowIndex][colIndex] = currentDrawMode;
        setCreatorGrid(newGrid);
      }
    }
  };

  const handleSubmit = () => {
    const isCorrect = JSON.stringify(gridState) === JSON.stringify(selectedPuzzle.grid);
    setMessage(isCorrect ? 'Congratulations! You solved the puzzle correctly!' : 'Sorry, that solution is not correct. Please try again.');
  };

  const changeCreatorGridSize = (size) => {
    setCreatorGridSize(size);
    setCreatorGrid(createEmptyGrid(size));
    setEditMode(false);
    setEditingPuzzleId(null);
    setCreatorName('New Puzzle');
  };

  const handleSaveCreatorPuzzle = () => {
    const { rows, cols } = computeClues(creatorGrid);
    if (editMode && editingPuzzleId) {
      const updatedPuzzles = puzzles.map(puzzle =>
        puzzle.id === editingPuzzleId
          ? { ...puzzle, name: creatorName, size: `${creatorGridSize}x${creatorGridSize}`, grid: JSON.parse(JSON.stringify(creatorGrid)), rows, cols }
          : puzzle
      );
      setPuzzles(updatedPuzzles);
      setSelectedPuzzle(updatedPuzzles.find(p => p.id === editingPuzzleId));
    } else {
      const newPuzzle = {
        id: Date.now(),
        name: creatorName,
        size: `${creatorGridSize}x${creatorGridSize}`,
        grid: JSON.parse(JSON.stringify(creatorGrid)),
        rows,
        cols
      };
      setPuzzles([...puzzles, newPuzzle]);
      setSelectedPuzzle(newPuzzle);
    }
    setEditMode(false);
    setEditingPuzzleId(null);
    setMessage('Puzzle saved successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleNewPuzzle = () => {
    setCreatorGrid(createEmptyGrid(creatorGridSize));
    setCreatorName('New Puzzle');
    setEditMode(false);
    setEditingPuzzleId(null);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  const getThemeClass = (elementType) => {
    const themeMap = {
      blue: {
        primary: 'bg-blue-600 hover:bg-blue-700',
        secondary: 'bg-blue-500 hover:bg-blue-600',
        sidebar: 'bg-blue-800',
        panelBg: 'bg-blue-50',
        tabActive: 'bg-white border-b-blue-500',
        tabInactive: 'bg-blue-200 hover:bg-blue-100',
        item: 'bg-blue-700 hover:bg-blue-600',
        itemActive: 'bg-blue-500',
        gridBorder: 'border-blue-300',
        success: 'bg-green-500',
        error: 'bg-red-500',
      },
      green: {
        primary: 'bg-green-600 hover:bg-green-700',
        secondary: 'bg-green-500 hover:bg-green-600',
        sidebar: 'bg-green-800',
        panelBg: 'bg-green-50',
        tabActive: 'bg-white border-b-green-500',
        tabInactive: 'bg-green-200 hover:bg-green-100',
        item: 'bg-green-700 hover:bg-green-600',
        itemActive: 'bg-green-500',
        gridBorder: 'border-green-300',
        success: 'bg-green-500',
        error: 'bg-red-500',
      },
      purple: {
        primary: 'bg-purple-600 hover:bg-purple-700',
        secondary: 'bg-purple-500 hover:bg-purple-600',
        sidebar: 'bg-purple-800',
        panelBg: 'bg-purple-50',
        tabActive: 'bg-white border-b-purple-500',
        tabInactive: 'bg-purple-200 hover:bg-purple-100',
        item: 'bg-purple-700 hover:bg-purple-600',
        itemActive: 'bg-purple-500',
        gridBorder: 'border-purple-300',
        success: 'bg-green-500',
        error: 'bg-red-500',
      }
    };

    return themeMap[theme][elementType] || '';
  };

  // File operations
  const handleBackupPuzzles = () => {
    const success = PuzzleFileStorage.savePuzzlesToFile(puzzles);
    setMessage(success ? 'Puzzles backed up successfully!' : 'Error backing up puzzles. Please try again.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRestorePuzzles = async () => {
    try {
      const restoredPuzzles = await PuzzleFileStorage.loadPuzzlesFromFile();
      if (restoredPuzzles && Array.isArray(restoredPuzzles) && restoredPuzzles.length > 0) {
        setPuzzles(restoredPuzzles);
        setSelectedPuzzle(restoredPuzzles[0]);
        setGridState(JSON.parse(JSON.stringify(restoredPuzzles[0].grid)));
        setMessage(`Restored ${restoredPuzzles.length} puzzles successfully!`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Error restoring puzzles. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleImportPuzzles = async () => {
    try {
      const importedPuzzles = await PuzzleFileStorage.loadPuzzlesFromFile();
      if (importedPuzzles && Array.isArray(importedPuzzles) && importedPuzzles.length > 0) {
        const existingIds = puzzles.map(p => p.id);
        const newPuzzles = importedPuzzles.filter(p => !existingIds.includes(p.id));
        if (newPuzzles.length > 0) {
          setPuzzles([...puzzles, ...newPuzzles]);
          setMessage(`Imported ${newPuzzles.length} new puzzles successfully!`);
        } else {
          setMessage('No new puzzles were imported. They may be duplicates of existing puzzles.');
        }
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Error importing puzzles. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // For visual aid in grid rendering, determine subgrid size
  const getSubgridSize = (size) => {
    if (size % 5 === 0) return 5;
    if (size % 4 === 0) return 4;
    return 5;
  };

  // Render the puzzle grid using CSS Grid for layout
  const renderGrid = (grid, isSolveMode = true) => {
    const size = grid.length;
    const { rows, cols } = isSolveMode
      ? { rows: selectedPuzzle.rows, cols: selectedPuzzle.cols }
      : computeClues(creatorGrid);
  
    // Compute the maximum number of clues on the left and top
    const maxRowClues = Math.max(...rows.map(r => r.length));
    const maxColClues = Math.max(...cols.map(c => c.length));
    // const clueSize = 2.5; // rem per clue cell (adjust as needed)
    const baseClueCount = 5;
    const baseClueSize = 2.5; //rem per clue cell for first 4 clues
    const extraIncrement = 0.5; //rem per clue cell for each additional clue
    const leftColWidth = `${baseClueCount * baseClueSize + Math.max(0, maxRowClues -baseClueCount) * extraIncrement}rem`;
    const topRowHeight = `${baseClueCount * baseClueSize + Math.max(0, maxColClues - baseClueCount) * extraIncrement}rem`;
  
    return (
      <div
        className="grid-container"
        style={{
          display: 'grid',
          gridTemplateColumns: `${leftColWidth} repeat(${size}, 2rem)`,
          gridTemplateRows: `${topRowHeight} repeat(${size}, 2rem)`,
          gap: '1px'
        }}
      >
        {/* Top-left empty cell */}
        <div style={{ backgroundColor: '#fff' }}></div>
        {/* Column clues */}
        {cols.map((clueList, colIndex) => (
          <div key={colIndex} className="col-clue">
            {clueList.map((clue, idx) => (
              <div key={idx} className="clue-label">{clue}</div>
            ))}
          </div>
        ))}
        {/* Rows with clues and grid cells */}
        {grid.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {/* Row clue */}
            <div className="row-clue">
              {rows[rowIndex].map((clue, idx) => (
                <span key={idx} className="clue-label mr-1">{clue}</span>
              ))}
            </div>
            {/* Grid cells */}
            {row.map((cell, colIndex) => {
              const isBoldRight =
                ((colIndex + 1) % getSubgridSize(size) === 0) && (colIndex < size - 1);
              const isBoldBottom =
                ((rowIndex + 1) % getSubgridSize(size) === 0) && (rowIndex < size - 1);
              return (
                <div
                  key={colIndex}
                  style={{
                    borderRight: isBoldRight ? '2px solid #000' : '1px solid #999',
                    borderBottom: isBoldBottom ? '2px solid #000' : '1px solid #999'
                  }}
                  className={`grid-cell ${cell === 1 ? 'bg-black' : cell === 2 ? 'bg-red-200' : 'bg-white'}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleMouseDown(rowIndex, colIndex, e.button === 2, isSolveMode);
                  }}
                  onMouseEnter={() => handleMouseEnter(rowIndex, colIndex, isSolveMode)}
                  onContextMenu={(e) => e.preventDefault()}
                ></div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };
  


  // Panels
  const renderSolverPanel = () => (
    <div className={`panel ${getThemeClass('panelBg')}`}>
      <h1 className="text-2xl font-bold mb-4">Solve: {selectedPuzzle?.name}</h1>
      <div className="mb-6">
        {selectedPuzzle && renderGrid(gridState, true)}
      </div>
      <button className={`btn text-white ${getThemeClass('primary')}`} onClick={handleSubmit}>
        Check Solution
      </button>
      {message && (
        <div className={`mt-4 p-3 rounded ${message.includes('Congratulations') ? 'message-success' : 'message-error'}`}>
          {message}
        </div>
      )}
      <div className="instructions">
        <h3 className="font-bold mb-2">How to Play:</h3>
        <ul className="list-disc pl-5">
          <li>Left-click to fill a cell in black</li>
          <li>Right-click to mark a cell as "can't be black" (light red)</li>
          <li>Click and drag to fill or mark multiple cells at once</li>
          <li>Fill the grid according to the number clues on the rows and columns</li>
          <li>Each number represents a continuous group of black cells</li>
          <li>Groups are separated by at least one empty cell</li>
          <li>Darker gridlines appear every {selectedPuzzle && getSubgridSize(gridState.length)} cells</li>
        </ul>
      </div>
    </div>
  );

  const renderCreatorPanel = () => (
    <div className={`panel ${getThemeClass('panelBg')}`}>
      <h1 className="text-2xl font-bold mb-4">
        {editMode ? `Edit: ${creatorName}` : 'Create New Puzzle'}
      </h1>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Puzzle Name:</label>
        <input
          type="text"
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
          className="px-3 py-2 border rounded w-64"
        />
      </div>
      {!editMode && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Grid Size:</label>
          <select
            value={creatorGridSize}
            onChange={(e) => changeCreatorGridSize(parseInt(e.target.value, 10))}
            className="px-3 py-2 border rounded"
          >
            <option value={8}>8 x 8</option>
            <option value={10}>10 x 10</option>
            <option value={15}>15 x 15</option>
            <option value={20}>20 x 20</option>
            <option value={25}>25 x 25</option>
          </select>
        </div>
      )}
      <div className="mb-6">
        {renderGrid(creatorGrid, false)}
      </div>
      <div className="flex space-x-4">
        <button className={`btn text-white ${getThemeClass('success')}`} onClick={handleSaveCreatorPuzzle}>
          {editMode ? 'Update Puzzle' : 'Save Puzzle'}
        </button>
        <button className="btn bg-gray-600 text-white hover:bg-gray-700" onClick={handleNewPuzzle}>
          New Puzzle
        </button>
      </div>
      {message && (
        <div className="message-success mt-4">
          {message}
        </div>
      )}
      <div className="instructions mt-6 p-4 bg-gray-200 rounded">
        <h3 className="font-bold mb-2">Creator Mode Instructions:</h3>
        <ul className="list-disc pl-5">
          <li>Click or drag to toggle cells between filled/empty</li>
          <li>The row and column clues update automatically</li>
          <li>Give your puzzle a name before saving</li>
          <li>Saved puzzles appear in the sidebar and can be edited or played</li>
        </ul>
      </div>
    </div>
  );

  // Sidebar with file operations and puzzle list
  const renderSidebar = () => (
    <div className="sidebar">
      <h2 className="text-xl font-bold mb-4">Griddler Puzzles</h2>
      <div className="mb-4 flex space-x-2">
        <button
          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          onClick={handleBackupPuzzles}
          title="Save all puzzles to a file"
        >
          Backup
        </button>
        <button
          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
          onClick={handleRestorePuzzles}
          title="Load puzzles from a file (replaces current puzzles)"
        >
          Restore
        </button>
        <button
          className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
          onClick={handleImportPuzzles}
          title="Add puzzles from a file"
        >
          Import
        </button>
      </div>
      <div className="border-t border-gray-700 mb-3 pt-3">
        <h3 className="text-sm text-gray-400 mb-2">Your Puzzles</h3>
      </div>
      <ul>
        {puzzles.map((puzzle) => (
          <li
            key={puzzle.id}
            className={`puzzle-item ${selectedPuzzle && selectedPuzzle.id === puzzle.id ? 'active' : ''}`}
            onClick={() => handleSelectPuzzle(puzzle)}
          >
            <div className="puzzle-item-name">{puzzle.name}</div>
            <div className="puzzle-item-size">{puzzle.size}</div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      {/* 1) The top bar for the Solve/Create tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'solve' ? 'active' : ''}`}
          onClick={() => setActiveTab('solve')}
        >
          Solve
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('create');
            setEditMode(false);
            setEditingPuzzleId(null);
            setCreatorName('New Puzzle');
            setCreatorGrid(createEmptyGrid(creatorGridSize));
          }}
        >
          Create
        </button>
      </div>
  
      {/* 2) A horizontal row with the sidebar on the left and main content on the right */}
      <div className="flex flex-1 bg-gray-100">
        {renderSidebar()}
        <div className="flex-1 flex flex-col">
          {activeTab === 'solve' ? renderSolverPanel() : renderCreatorPanel()}
        </div>
      </div>
    </div>
  );
};

export default GriddlerApp;
