import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  TextField,
  Button,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup, // Dodano
  ToggleButton,    // Dodano
  Grid,
  Skeleton
} from '@mui/material';
import { Add as AddIcon, Payment as PaymentIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Grow } from '@mui/material';
import { motion } from 'framer-motion';
// Dodano Bar
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Dodano BarElement
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Dodano BarElement do rejestracji
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement, // Dodano
  Title,
  Tooltip,
  Legend
);

function LoadingState() {
  return (
    <Box
      sx={{
        maxWidth: '1400px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      <Skeleton
        variant="rounded"
        height={200}
        sx={{
          mb: 3,
          transform: 'none',
          animation: 'pulse 1.5s ease-in-out 0.5s infinite'
        }}
      />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Skeleton
            variant="rounded"
            height={400}
            sx={{
              transform: 'none',
              animation: 'pulse 1.5s ease-in-out 0.5s infinite'
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton
            variant="rounded"
            height={400}
            sx={{
              transform: 'none',
              animation: 'pulse 1.5s ease-in-out 0.5s infinite'
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

function PersonDebts() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openDebtDialog, setOpenDebtDialog] = useState(false);
  const [openRepaymentDialog, setOpenRepaymentDialog] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'debts', 'repayments', 'all'
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const navigate = useNavigate();

  // NOWY STAN: Do wyboru typu wykresu
  const [chartViewMode, setChartViewMode] = useState('cumulative'); // 'cumulative' (łączny) lub 'monthly' (miesięczny)

  const [newDebt, setNewDebt] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [newRepayment, setNewRepayment] = useState({
    amount: '',
    method: 'Gotówka',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [openTransactionDeleteDialog, setOpenTransactionDeleteDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const docRef = doc(db, 'users', auth.currentUser.uid, 'people', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPerson({ id: docSnap.id, ...docSnap.data() });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAddDebt = async () => {
    const debtToAdd = {
      type: 'debt',
      ...newDebt,
      amount: parseFloat(newDebt.amount),
      date: new Date(newDebt.date), // Firestore przechowa to jako Timestamp
      timestamp: new Date()
    };

    const updatedTransactions = [...(person.transactions || []), debtToAdd];
    const newTotalDebt = (person.totalDebt || 0) + debtToAdd.amount;

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenDebtDialog(false);
    refreshPersonData();
  };

  const handleAddRepayment = async () => {
    const repaymentToAdd = {
      type: 'repayment',
      ...newRepayment,
      amount: parseFloat(newRepayment.amount),
      date: new Date(newRepayment.date), // Firestore przechowa to jako Timestamp
      timestamp: new Date()
    };

    const updatedTransactions = [...(person.transactions || []), repaymentToAdd];
    const newTotalDebt = (person.totalDebt || 0) - repaymentToAdd.amount;

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenRepaymentDialog(false);
    refreshPersonData();
  };

  const refreshPersonData = async () => {
    const docRef = doc(db, 'users', auth.currentUser.uid, 'people', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) { // Dodano sprawdzenie na wypadek usunięcia osoby w międzyczasie
        setPerson({ id: docSnap.id, ...docSnap.data() });
    }
  };

  const getFilteredTransactions = () => {
    if (!person?.transactions) return [];
    let transactions;
    switch (viewMode) {
      case 'debts':
        transactions = person.transactions.filter(t => t.type === 'debt');
        break;
      case 'repayments':
        transactions = person.transactions.filter(t => t.type === 'repayment');
        break;
      default:
        transactions = person.transactions;
    }
    // Sortowanie po dacie (od najnowszych) - oryginalna logika
    return transactions.sort((a, b) => b.date.toDate() - a.date.toDate());
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'people', id));
      navigate('/');
    } catch (error) {
      console.error('Błąd podczas usuwania:', error);
    }
  };

  // Oryginalna funkcja dla wykresu łącznego (teraz kumulacyjnego)
  const getCumulativeChartData = () => {
    if (!person?.transactions) return { labels: [], datasets: [] };

    // Upewnij się, że transakcje są posortowane wg daty dla poprawnego salda
    const sortedTransactions = [...person.transactions].sort((a, b) =>
      a.date.toDate() - b.date.toDate()
    );

    let balance = 0;
    const data = sortedTransactions.map(t => {
      const transactionDate = t.date.toDate(); // Konwersja Timestamp Firestore na obiekt Date
      balance += t.type === 'debt' ? t.amount : -t.amount;
      return {
        date: transactionDate,
        balance
      };
    });

    return {
      labels: data.map(d => d.date.toLocaleDateString('pl-PL')),
      datasets: [
        {
          label: 'Dług (Łącznie)', // Zmieniono etykietę dla jasności
          data: data.map(d => d.balance),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
  };

  // NOWA FUNKCJA: Dane dla wykresu miesięcznego (słupkowego)
  const getMonthlyChartData = () => {
    if (!person?.transactions || person.transactions.length === 0) {
      return { labels: [], datasets: [] };
    }

    const monthlyData = {}; // Klucz: 'RRRR-MM', Wartość: { debts: 0, repayments: 0, dateObject: Date }

    person.transactions.forEach(t => {
      const date = t.date.toDate(); // Konwersja Timestamp Firestore na obiekt Date
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed (Styczeń = 0)
      const key = `${year}-${String(month + 1).padStart(2, '0')}`; // Format RRRR-MM

      if (!monthlyData[key]) {
        monthlyData[key] = { debts: 0, repayments: 0, dateObject: new Date(year, month, 1) };
      }

      if (t.type === 'debt') {
        monthlyData[key].debts += t.amount;
      } else if (t.type === 'repayment') {
        monthlyData[key].repayments += t.amount;
      }
    });

    // Sortowanie kluczy (miesięcy) chronologicznie
    const sortedMonthKeys = Object.keys(monthlyData).sort((a, b) => {
        return monthlyData[a].dateObject.getTime() - monthlyData[b].dateObject.getTime();
    });

    const labels = sortedMonthKeys.map(key =>
      monthlyData[key].dateObject.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    );

    return {
      labels,
      datasets: [
        {
          label: 'Nowe zadłużenia (Miesięcznie)',
          data: sortedMonthKeys.map(key => monthlyData[key].debts),
          backgroundColor: 'rgba(255, 99, 132, 0.5)', // Czerwony dla długów
          borderColor: 'rgb(255, 99, 132)',
          borderWidth: 1,
        },
        {
          label: 'Spłaty (Miesięcznie)',
          data: sortedMonthKeys.map(key => monthlyData[key].repayments),
          backgroundColor: 'rgba(75, 192, 192, 0.5)', // Zielono-niebieski dla spłat
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1,
        },
      ],
    };
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    const updatedTransactions = person.transactions.filter((t, index) => index !== transactionToDelete.index);
    const amountChange = transactionToDelete.transaction.type === 'debt'
      ? -transactionToDelete.transaction.amount
      : transactionToDelete.transaction.amount;

    const newTotalDebt = (person.totalDebt || 0) + amountChange;

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenTransactionDeleteDialog(false);
    setTransactionToDelete(null);
    refreshPersonData();
  };

  if (loading) {
    return <LoadingState />;
  }

  // Dodano sprawdzenie czy 'person' istnieje, aby uniknąć błędów przy renderowaniu
  if (!person) {
    return (
        <Box sx={{ maxWidth: '1400px', width: { xs: '95%', sm: '100%' }, margin: '2rem auto', padding: { xs: '0.5rem', sm: '2rem' } }}>
            <Typography variant="h5" align="center">Ładowanie danych osoby lub osoba nie istnieje.</Typography>
            <Button component={Link} to="/" variant="outlined" sx={{ mt: 2, display: 'block', margin: 'auto' }}>
                ← Powrót do listy
            </Button>
        </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        maxWidth: '1400px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      {/* Sekcja 1: Nawigacja, akcje i podsumowanie - BEZ ZMIAN WIZUALNYCH (poza tym co konieczne dla person) */}
      <Paper elevation={3} sx={{
        padding: '2rem',
        mb: 3,
        backgroundColor: '#ffffff',
        color: 'rgb(30, 41, 59)',
        borderTop: 3,
        borderColor: person.totalDebt > 0 ? 'error.main' : 'success.main',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '30%',
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${
            person.totalDebt > 0
              ? 'rgba(211, 47, 47, 0.05)'
              : 'rgba(76, 175, 80, 0.05)'
          })`,
          zIndex: 0
        }
      }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                component={Link}
                to="/"
                variant="outlined"
                sx={{ minWidth: 'auto' }}
              >
                ← Powrót
              </Button>
              <Typography variant="h5">{person.name}</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: person.totalDebt > 0 ? 'error.main' : 'success.main',
              color: person.totalDebt > 0 ? 'error.main' : 'success.main',
              bgcolor: person.totalDebt > 0 ? 'error.50' : 'success.50' // MUI v5 style
            }}>
              <Typography variant="subtitle1" fontWeight="medium">
                Dług: {new Intl.NumberFormat('pl-PL', {
                  style: 'currency',
                  currency: 'PLN'
                }).format(person.totalDebt || 0)}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{
              display: 'flex',
              gap: 1,
              justifyContent: 'flex-end'
            }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDebtDialog(true)}
                size="small"
              >
                Dodaj Płatność
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<PaymentIcon />}
                onClick={() => setOpenRepaymentDialog(true)}
                size="small"
              >
                Dodaj Spłatę
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setOpenDeleteDialog(true)}
                size="small"
              >
                Usuń
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
        width: '100%',
        alignItems: { xs: 'center', md: 'stretch' }
      }}>
        {/* Lewa kolumna - Historia transakcji - BEZ ZMIAN WIZUALNYCH */}
        <Paper elevation={3} sx={{
          padding: { xs: '1rem', sm: '2rem' },
          width: { xs: '95%', md: '60%' },
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderTop: 3,
          borderColor: 'primary.main',
          position: 'relative',
          overflow: 'hidden',
          height: '500px',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '30%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(25, 118, 210, 0.05))',
            zIndex: 0
          }
        }}>
          <Typography variant="h6" gutterBottom sx={{
            color: 'primary.main',
            fontWeight: 'medium',
            position: 'relative',
            zIndex: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' }
          }}>
            Historia transakcji
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newValue) => { if (newValue !== null) setViewMode(newValue);}} // Zapobiega odznaczeniu wszystkiego
            sx={{
              mb: 3, // Oryginalny margines
              flexWrap: 'wrap',
              '& .MuiToggleButton-root': {
                padding: { xs: '6px 12px', sm: '8px 16px' },
                fontSize: { xs: '0.8rem', sm: '0.875rem' }
              }
            }}
          >
            <ToggleButton value="all">Wszystko</ToggleButton>
            <ToggleButton value="debts">Płatności</ToggleButton>
            <ToggleButton value="repayments">Spłaty</ToggleButton>
          </ToggleButtonGroup>
          <List sx={{
            overflow: 'auto',
            flex: 1,
            maxHeight: '350px', // Oryginalna wysokość
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', '&:hover': { backgroundColor: 'rgba(0,0,0,0.3)' } },
          }}>
            {getFilteredTransactions().map((transaction, index) => (
              <ListItem
                key={index} // Oryginalny klucz
                sx={{
                  padding: { xs: '4px 8px', sm: '8px 16px' },
                  '& .MuiTypography-root': { fontSize: { xs: '0.875rem', sm: '1rem' } }
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => {
                      setTransactionToDelete({ transaction, index });
                      setOpenTransactionDeleteDialog(true);
                    }}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Typography color={transaction.type === 'debt' ? 'error' : 'success'}>
                      {transaction.type === 'debt' ? '-' : '+'}
                      {new Intl.NumberFormat('pl-PL', {
                        style: 'currency',
                        currency: 'PLN'
                      }).format(transaction.amount)}
                      {transaction.type === 'repayment' && ` (${transaction.method})`}
                    </Typography>
                  }
                  // Użycie .toDate() jest konieczne, bo 'date' z Firestore to Timestamp
                  secondary={`${transaction.description} - ${transaction.date.toDate().toLocaleDateString('pl-PL')}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Prawa kolumna - wykres - Z MODYFIKACJAMI */}
        <Paper elevation={3} sx={{
          padding: { xs: '1rem', sm: '2rem' },
          width: { xs: '95%', md: '40%' },
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderTop: 3,
          borderColor: 'success.main',
          position: 'relative',
          overflow: 'hidden',
          height: '500px',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: '30%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.05))',
            zIndex: 0
          }
        }}>
          <Typography variant="h6" gutterBottom sx={{
            color: 'success.main',
            fontWeight: 'medium',
            position: 'relative',
            zIndex: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' }
          }}>
            Historia zadłużenia
          </Typography>

          {/* NOWY ELEMENT: Przełącznik typu wykresu */}
          <ToggleButtonGroup
            value={chartViewMode}
            exclusive
            onChange={(event, newViewMode) => {
              if (newViewMode !== null) { // Zapobiega sytuacji, gdy nic nie jest wybrane
                setChartViewMode(newViewMode);
              }
            }}
            aria-label="Wybór typu wykresu"
            size="small"
            sx={{ mb: 2, alignSelf: 'center' }} // Wyśrodkowanie przełącznika
          >
            <ToggleButton value="cumulative" aria-label="Łącznie">
              Łącznie
            </ToggleButton>
            <ToggleButton value="monthly" aria-label="Miesięczny">
              Miesięczny
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {/* Warunkowe renderowanie wykresu */}
            {chartViewMode === 'cumulative' ? (
              <Line
                data={getCumulativeChartData()} // Używamy nowej nazwy funkcji dla danych kumulacyjnych
                options={{ // Oryginalne opcje dla wykresu liniowego
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top', labels: { font: { size: window.innerWidth < 600 ? 10 : 12 } } },
                    title: { display: false }
                  },
                  scales: {
                    y: { /* beginAtZero: true, - dla salda może być ujemne, więc usunięto*/ ticks: { font: { size: window.innerWidth < 600 ? 10 : 12 } } },
                    x: { ticks: { font: { size: window.innerWidth < 600 ? 8 : 10 } } }
                  }
                }}
              />
            ) : ( // chartViewMode === 'monthly'
              <Bar
                data={getMonthlyChartData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top', labels: { font: { size: window.innerWidth < 600 ? 10 : 12 } } },
                    title: { display: false }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      stacked: false, // Słupki obok siebie
                      ticks: { font: { size: window.innerWidth < 600 ? 10 : 12 } }
                    },
                    x: {
                      stacked: false,
                      ticks: { font: { size: window.innerWidth < 600 ? 8 : 10 } }
                    }
                  }
                }}
              />
            )}
          </Box>
        </Paper>
      </Box>

      {/* Dialogi - BEZ ZMIAN WIZUALNYCH/FUNKCJONALNYCH (poza tym co konieczne dla person) */}
      <Dialog open={openDebtDialog} onClose={() => setOpenDebtDialog(false)}>
        <DialogTitle>Dodaj nowy dług</DialogTitle>
        <DialogContent>
          <TextField
            label="Kwota"
            type="number"
            value={newDebt.amount}
            onChange={(e) => setNewDebt({ ...newDebt, amount: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Opis"
            value={newDebt.description}
            onChange={(e) => setNewDebt({ ...newDebt, description: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Data"
            type="date"
            value={newDebt.date}
            onChange={(e) => setNewDebt({ ...newDebt, date: e.target.value })}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }} // Utrzymane z oryginalnego kodu jeśli tam było
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDebtDialog(false)}>Anuluj</Button>
          <Button onClick={handleAddDebt} variant="contained">Dodaj</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openRepaymentDialog} onClose={() => setOpenRepaymentDialog(false)}>
        <DialogTitle>Dodaj spłatę</DialogTitle>
        <DialogContent>
          <TextField
            label="Kwota spłaty"
            type="number"
            value={newRepayment.amount}
            onChange={(e) => setNewRepayment({ ...newRepayment, amount: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Opis"
            value={newRepayment.description}
            onChange={(e) => setNewRepayment({ ...newRepayment, description: e.target.value })}
            fullWidth
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel
              sx={{
                '&.MuiInputLabel-shrink': {
                  bgcolor: 'white',
                  padding: '0 8px',
                }
              }}
            >
              Metoda płatności
            </InputLabel>
            <Select
              value={newRepayment.method}
              onChange={(e) => setNewRepayment({ ...newRepayment, method: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                borderRadius: '0.5rem'
              }}
            >
              <MenuItem value="Gotówka">Gotówka</MenuItem>
              <MenuItem value="Konto">Konto</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Data"
            type="date"
            value={newRepayment.date}
            onChange={(e) => setNewRepayment({ ...newRepayment, date: e.target.value })}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }} // Utrzymane z oryginalnego kodu jeśli tam było
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRepaymentDialog(false)}>Anuluj</Button>
          <Button onClick={handleAddRepayment} variant="contained" color="success">
            Dodaj spłatę
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 500 }}
      >
        <DialogTitle>Potwierdź usunięcie</DialogTitle>
        <DialogContent>
          <Typography>
            Czy na pewno chcesz usunąć {person.name} i wszystkie powiązane transakcje?
            Tej operacji nie można cofnąć.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Anuluj</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Usuń
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openTransactionDeleteDialog}
        onClose={() => setOpenTransactionDeleteDialog(false)}
        TransitionComponent={Grow}
        TransitionProps={{ timeout: 500 }}
      >
        <DialogTitle>Potwierdź usunięcie transakcji</DialogTitle>
        <DialogContent>
          <Typography>
            Czy na pewno chcesz usunąć tę transakcję?
            {transactionToDelete && (
              <>
                <br />
                <strong>
                  {transactionToDelete.transaction.type === 'debt' ? 'Dług' : 'Spłata'}:{' '}
                  {new Intl.NumberFormat('pl-PL', {
                    style: 'currency',
                    currency: 'PLN'
                  }).format(transactionToDelete.transaction.amount)}
                </strong>
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTransactionDeleteDialog(false)}>Anuluj</Button>
          <Button onClick={handleDeleteTransaction} color="error" variant="contained">
            Usuń
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PersonDebts;