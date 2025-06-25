import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box
} from '@mui/material';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';

function GroupPayment({ open, onClose, onSuccess }) {
  const [allPeople, setAllPeople] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [includeCreator, setIncludeCreator] = useState(true);
  const [payment, setPayment] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      const fetchPeople = async () => {
        if (!auth.currentUser) return;
        const peopleCollection = collection(db, 'users', auth.currentUser.uid, 'people');
        const peopleSnapshot = await getDocs(peopleCollection);
        const peopleList = peopleSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllPeople(peopleList);
      };

      fetchPeople();
    }
  }, [open]);

  const handleTogglePerson = (personId) => {
    setSelectedPeople(prev =>
      prev.includes(personId)
        ? prev.filter(id => id !== personId)
        : [...prev, personId]
    );
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;

    const totalPeople = selectedPeople.length + (includeCreator ? 1 : 0);
    if (totalPeople === 0 || !payment.amount) {
      alert('Proszę wybrać przynajmniej jedną osobę i podać kwotę.');
      return;
    }

    try {
      const amountPerPerson = parseFloat(payment.amount) / totalPeople;

      for (const personId of selectedPeople) {
        const personRef = doc(db, 'users', auth.currentUser.uid, 'people', personId);
        const personData = allPeople.find(p => p.id === personId);
        if (!personData) continue;

        await updateDoc(personRef, {
          totalDebt: (personData.totalDebt || 0) + amountPerPerson,
          transactions: arrayUnion({
            type: 'debt',
            amount: amountPerPerson,
            description: payment.description,
            date: new Date(payment.date),
            timestamp: new Date()
          })
        });
      }

      onSuccess?.();
      onClose();
      setPayment({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      setSelectedPeople([]);
      setSearchQuery('');

    } catch (error) {
      console.error('Błąd podczas dodawania płatności grupowej:', error);
    }
  };

  const filteredPeople = allPeople
    .filter(person => !person.isSummary)
    .filter(person =>
      person.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle>Grupowa Płatność</DialogTitle>
      <DialogContent sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        <Box sx={{ flex: '0 0 auto' }}>
          <TextField
            label="Kwota"
            type="number"
            value={payment.amount}
            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Opis"
            value={payment.description}
            onChange={(e) => setPayment({ ...payment, description: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Data"
            type="date"
            value={payment.date}
            onChange={(e) => setPayment({ ...payment, date: e.target.value })}
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={includeCreator}
                onChange={(e) => setIncludeCreator(e.target.checked)}
              />
            }
            label="Uwzględnij mnie w podziale"
          />

          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
            Wybierz osoby:
          </Typography>

          <TextField
            fullWidth
            size="small"
            label="Szukaj osoby"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ mb: 2 }}
          />
        </Box>

        <List sx={{
          flex: '1 1 auto',
          overflow: 'auto',
          border: '1px solid rgba(0, 0, 0, 0.12)',
          borderRadius: 1,
          minHeight: { xs: '150px', sm: '200px' },
          maxHeight: { xs: '200px', sm: '300px' },
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.3)',
            },
          },
        }}>
          {filteredPeople.map((person) => (
            <ListItem
              key={person.id}
              dense
              button
              onClick={() => handleTogglePerson(person.id)}
              sx={{
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                '&:last-child': {
                  borderBottom: 'none',
                },
              }}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selectedPeople.includes(person.id)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText 
                primary={person.name}
                secondary={selectedPeople.includes(person.id) ? 'Wybrano' : null}
              />
            </ListItem>
          ))}
        </List>

        {payment.amount && (selectedPeople.length > 0 || includeCreator) && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'right' }}>
            Kwota na osobę: {new Intl.NumberFormat('pl-PL', {
              style: 'currency',
              currency: 'PLN'
            }).format(payment.amount / (selectedPeople.length + (includeCreator ? 1 : 0)))}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Anuluj</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Dodaj płatność
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default GroupPayment;