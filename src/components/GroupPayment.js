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
  const [people, setPeople] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [includeCreator, setIncludeCreator] = useState(true);
  const [payment, setPayment] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const fetchPeople = async () => {
      if (!auth.currentUser) return;
      const peopleCollection = collection(db, 'users', auth.currentUser.uid, 'people');
      const peopleSnapshot = await getDocs(peopleCollection);
      const peopleList = peopleSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPeople(peopleList);
    };

    fetchPeople();
  }, []);

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
    if (totalPeople === 0) {
      alert('Wybierz co najmniej jedną osobę');
      return;
    }

    try {
      const amountPerPerson = parseFloat(payment.amount) / totalPeople;

      for (const personId of selectedPeople) {
        const personRef = doc(db, 'users', auth.currentUser.uid, 'people', personId);
        await updateDoc(personRef, {
          totalDebt: people.find(p => p.id === personId).totalDebt + amountPerPerson,
          transactions: arrayUnion({
            type: 'debt',
            amount: amountPerPerson,
            description: payment.description,
            date: new Date(payment.date)
          })
        });
      }

      onSuccess?.();
      onClose();
      setPayment({
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      setSelectedPeople([]);
    } catch (error) {
      console.error('Błąd podczas dodawania płatności grupowej:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Grupowa Płatność</DialogTitle>
      <DialogContent>
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
        />
        
        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeCreator}
                onChange={(e) => setIncludeCreator(e.target.checked)}
              />
            }
            label="Uwzględnij mnie w podziale"
          />
        </Box>

        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
          Wybierz osoby:
        </Typography>
        <List>
          {people.map((person) => (
            <ListItem
              key={person.id}
              dense
              button
              onClick={() => handleTogglePerson(person.id)}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selectedPeople.includes(person.id)}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={person.name} />
            </ListItem>
          ))}
        </List>

        {payment.amount && selectedPeople.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
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