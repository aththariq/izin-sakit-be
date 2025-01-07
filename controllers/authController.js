// ...existing code...

const googleCallback = async (req, res) => {
  try {
    // ...existing code...
    
    // Gunakan FRONTEND_URL dari environment
    const redirectUrl = `${process.env.FRONTEND_URL}/Dashboard?token=${token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    // ...existing code...
  }
};

// ...existing code...
