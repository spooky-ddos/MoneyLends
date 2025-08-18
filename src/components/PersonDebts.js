import React, { useState, useEffect, useCallback } from 'react'; // Dodajemy useCallback
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
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Skeleton,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Add as AddIcon, Payment as PaymentIcon, Delete as DeleteIcon, CreditScore as CreditScoreIcon } from '@mui/icons-material';
import { Grow } from '@mui/material';
import { motion } from 'framer-motion';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useSnackbar } from '../contexts/SnackbarContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  const [viewMode, setViewMode] = useState('all');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [chartViewMode, setChartViewMode] = useState('cumulative');

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

  const fetchData = useCallback(async () => {
    try {
      if (!auth.currentUser) return;
      const docRef = doc(db, 'users', auth.currentUser.uid, 'people', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setPerson({ ...data, isSummary: !!data.isSummary });
      }
    } catch (error) {
        console.error("Błąd podczas pobierania danych:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleIsSummary = async (event) => {
    const newIsSummary = event.target.checked;
    if (!person) return;

    setPerson(prev => ({ ...prev, isSummary: newIsSummary }));

    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'people', id);
      await updateDoc(docRef, {
        isSummary: newIsSummary
      });
      showSnackbar(`Pomyślnie zmieniono status na: ${newIsSummary ? 'Podliczenie' : 'Osoba'}`, 'success');
    } catch (error) {
      console.error("Błąd podczas aktualizacji statusu:", error);
      showSnackbar('Wystąpił błąd podczas zmiany statusu', 'error');
      setPerson(prev => ({ ...prev, isSummary: !newIsSummary }));
    }
  };

  const handleAddDebt = async () => {
    const debtToAdd = {
      type: 'debt',
      ...newDebt,
      amount: parseFloat(newDebt.amount),
      date: new Date(newDebt.date),
      timestamp: new Date()
    };

    const updatedTransactions = [...(person.transactions || []), debtToAdd];
    const newTotalDebt = parseFloat(((person.totalDebt || 0) + debtToAdd.amount).toFixed(2));

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenDebtDialog(false);
    setNewDebt({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    fetchData();
  };

  const handleAddRepayment = async () => {
    const repaymentToAdd = {
      type: 'repayment',
      ...newRepayment,
      amount: parseFloat(newRepayment.amount),
      date: new Date(newRepayment.date),
      timestamp: new Date()
    };

    const updatedTransactions = [...(person.transactions || []), repaymentToAdd];
    const newTotalDebt = parseFloat(((person.totalDebt || 0) - repaymentToAdd.amount).toFixed(2));

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenRepaymentDialog(false);
    setNewRepayment({ amount: '', method: 'Gotówka', date: new Date().toISOString().split('T')[0], description: '' });
    fetchData();
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
    return transactions.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return b.date.toDate() - a.date.toDate();
    });
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'people', id));
      navigate('/');
    } catch (error) {
      console.error('Błąd podczas usuwania:', error);
    }
  };

  const getCumulativeChartData = () => {
    if (!person?.transactions) return { labels: [], datasets: [] };

    const sortedTransactions = [...person.transactions].sort((a, b) =>
      a.date.toDate() - b.date.toDate()
    );

    let balance = 0;
    const data = sortedTransactions.map(t => {
      const transactionDate = t.date.toDate();
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
          label: 'Dług (Łącznie)',
          data: data.map(d => d.balance),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
  };
  
  const getMonthlyChartData = () => {
    if (!person?.transactions || person.transactions.length === 0) {
      return { labels: [], datasets: [] };
    }

    const monthlyData = {};

    person.transactions.forEach(t => {
      const date = t.date.toDate();
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (!monthlyData[key]) {
        monthlyData[key] = { debts: 0, repayments: 0, dateObject: new Date(year, month, 1) };
      }

      if (t.type === 'debt') {
        monthlyData[key].debts += t.amount;
      } else if (t.type === 'repayment') {
        monthlyData[key].repayments += t.amount;
      }
    });

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
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgb(255, 99, 132)',
          borderWidth: 1,
        },
        {
          label: 'Spłaty (Miesięcznie)',
          data: sortedMonthKeys.map(key => monthlyData[key].repayments),
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
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

    const newTotalDebt = parseFloat(((person.totalDebt || 0) + amountChange).toFixed(2));

    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'people', id), {
      transactions: updatedTransactions,
      totalDebt: newTotalDebt
    });

    setOpenTransactionDeleteDialog(false);
    setTransactionToDelete(null);
    fetchData();
  };

  const handleQuickRepay = () => {
      if (person && person.totalDebt > 0) {
        setNewRepayment(prev => ({ 
          ...prev, 
          amount: parseFloat(person.totalDebt.toFixed(2)) 
        }));
        setOpenRepaymentDialog(true);
      }
  };
  
  if (loading) {
    return <LoadingState />;
  }

  if (!person) {
    return (
        <Box sx={{ maxWidth: '1400px', width: { xs: '95%', sm: '100%' }, margin: '2rem auto', padding: { xs: '0.5rem', sm: '2rem' } }}>
            <Typography variant="h5" align="center">Ładowanie danych lub pozycja nie istnieje.</Typography>
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
      <Paper elevation={3} sx={{
        padding: '2rem',
        mb: 3,
        backgroundColor: '#ffffff',
        color: 'rgb(30, 41, 59)',
        borderTop: 3,
        borderColor: person.isSummary ? 'info.main' : (person.totalDebt > 0 ? 'error.main' : 'success.main'),
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button component={Link} to="/" variant="outlined" sx={{ minWidth: 'auto' }}>
                ←
              </Button>
              <Typography variant="h5">{person.name}</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: person.isSummary ? 'info.main' : (person.totalDebt > 0 ? 'error.main' : 'success.main'),
              color: person.isSummary ? 'info.main' : (person.totalDebt > 0 ? 'error.main' : 'success.main'),
            }}>
              <Typography variant="subtitle1" fontWeight="medium">
                {person.isSummary ? "Suma wydatków" : "Dług"}: {new Intl.NumberFormat('pl-PL', {
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
              justifyContent: { xs: 'flex-start', md: 'flex-end' },
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={person.isSummary}
                    onChange={handleToggleIsSummary}
                    color="primary"
                  />
                }
                label="Podliczenie"
                sx={{ mr: 2 }}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDebtDialog(true)} size="small">
                Dodaj Płatność
              </Button>
              <Button variant="contained" color="success" startIcon={<PaymentIcon />} onClick={() => setOpenRepaymentDialog(true)} size="small">
                Dodaj Spłatę
              </Button>
                {!person.isSummary && person.totalDebt > 0 && (
              <Button 
                variant="contained" 
                color="success" 
                startIcon={<CreditScoreIcon />} 
                onClick={handleQuickRepay} 
                size="small"
              >
                Szybka spłata
              </Button>
              )}
              <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setOpenDeleteDialog(true)} size="small">
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
            onChange={(e, newValue) => { if (newValue !== null) setViewMode(newValue);}}
            sx={{
              mb: 3,
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
            maxHeight: '350px',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px', '&:hover': { backgroundColor: 'rgba(0,0,0,0.3)' } },
          }}>
            {getFilteredTransactions().map((transaction, index) => (
              <ListItem
                key={index}
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
                  secondary={`${transaction.description} - ${transaction.date.toDate().toLocaleDateString('pl-PL')}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

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

          <ToggleButtonGroup
            value={chartViewMode}
            exclusive
            onChange={(event, newViewMode) => {
              if (newViewMode !== null) {
                setChartViewMode(newViewMode);
              }
            }}
            aria-label="Wybór typu wykresu"
            size="small"
            sx={{ mb: 2, alignSelf: 'center' }}
          >
            <ToggleButton value="cumulative" aria-label="Łącznie">
              Łącznie
            </ToggleButton>
            <ToggleButton value="monthly" aria-label="Miesięczny">
              Miesięczny
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {chartViewMode === 'cumulative' ? (
              <Line
                data={getCumulativeChartData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top', labels: { font: { size: window.innerWidth < 600 ? 10 : 12 } } },
                    title: { display: false }
                  },
                  scales: {
                    y: { ticks: { font: { size: window.innerWidth < 600 ? 10 : 12 } } },
                    x: { ticks: { font: { size: window.innerWidth < 600 ? 8 : 10 } } }
                  }
                }}
              />
            ) : (
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
                      stacked: false,
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
            InputLabelProps={{ shrink: true }}
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
            InputLabelProps={{ shrink: true }}
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