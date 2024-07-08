const axios = require('axios');

async function getRooms() {
  try {
    console.log('Fetching rooms from API...');
    const response = await axios.get('https://bot9assignement.deno.dev/rooms');
    console.log('Rooms fetched successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error faced while fetching rooms:', error);
    throw error;
  }
}

async function bookRoom(roomType, fullName, email, nights, checkIn, checkOut) {
  try {
    console.log('Booking room with details:', { roomType, fullName, email, nights, checkIn, checkOut });
    
    // Convert roomType to roomId (you may need to adjust this based on your actual room types and IDs)
    const roomTypeToId = {
      'Deluxe Room': 1,
      'Suite': 2,
      'Executive Room': 3,
      'Family Room': 4
    };
    const roomId = roomTypeToId[roomType] || 1; // Default to 1 if room type is not found

    const response = await axios.post('https://bot9assignement.deno.dev/book', {
      roomId,
      fullName,
      email,
      nights
    });
    
    console.log('Booking response:', response.data);
    
    // Add check-in and check-out dates to the response
    const result = {
      ...response.data,
      checkIn,
      checkOut,
      roomType
    };
    
    return result;
  } catch (error) {
    console.error('Error while booking room:', error);
    throw error;
  }
}

module.exports = { getRooms, bookRoom };