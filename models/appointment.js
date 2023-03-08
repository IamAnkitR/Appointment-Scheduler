'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Appointment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Appointment.belongsTo(models.Admin, {
        foreignKey: "adminId",
      });
    }
    static addAppointment({ title, start, end, adminId }) {
      return this.create({
        title: title,
        start: start,
        end: end,
        adminId,
      });
    }
    static getAppointments(adminId) {
      return this.findAll({
        where: {
          adminId,
        },
        order: [["id", "ASC"]],
      });
    }
  }
  Appointment.init({
    title: DataTypes.STRING,
    start: DataTypes.TIME,
    end: DataTypes.TIME
  }, {
    sequelize,
    modelName: 'Appointment',
  });
  return Appointment;
};