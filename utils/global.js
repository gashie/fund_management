
module.exports = {
    prepareColumns: (payload) => {
      let columns = Object.keys(payload)
      let ids = '';
      for (let i = 0; i < columns.length; i++) {
        ids += i === 0 ? '$1' : `, $${i + 1}`;
      }
      return ids;
    },
  
  
  
  
  };