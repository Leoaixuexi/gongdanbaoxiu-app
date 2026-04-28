const store = require('./store')
const { getNavBarInfo } = require('../../utils/navigation')
const { smartCompress, COMPRESS_PRESETS } = require('../../utils/imageUtils')

// 压缩本地临时图片，失败则返回原路径
async function compressLocalImages(tempPaths) {
  const results = []
  for (const p of tempPaths) {
    try {
      const r = await smartCompress(p, COMPRESS_PRESETS.WORKORDER)
      results.push(r.path)
    } catch (_) {
      results.push(p)
    }
  }
  return results
}

function computeDuration(sDate, sClock, eDate, eClock) {
  if (!sDate || !sClock || !eDate || !eClock) return ''
  const s = new Date(`${sDate}T${sClock}:00`)
  const e = new Date(`${eDate}T${eClock}:00`)
  if (isNaN(s) || isNaN(e) || e <= s) return ''
  const h = (e - s) / 3600000
  return h.toFixed(1) + 'h'
}

function parseStored(t) {
  if (!t) return { date: '', clock: '' }
  const m = t.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/)
  if (!m) return { date: '', clock: '' }
  const y = m[1] || new Date().getFullYear()
  const pad = v => String(v).padStart(2, '0')
  return {
    date: `${y}-${pad(m[2])}-${pad(m[3])}`,
    clock: `${pad(m[4])}:${pad(m[5])}`,
  }
}

function sumParts(parts) {
  return (parts || []).reduce((s, p) => s + (Number(p.qty) || 0) * (Number(p.price) || 0), 0)
}

Page({
  data: {
    headerHeight: 0,
    id: '',
    form: {
      confirmNo: '',
      repairVendor: '',
      repairer: '',
      follower: '',
      startDate: '',
      startClock: '',
      endDate: '',
      endClock: '',
      duration: '',
      hourlyRate: '',
      partsChanged: false,
      parts: [],
      photosBefore: [],
      photosAfter: [],
      photosConfirm: [],
      discount: '',
      chargeRemark: '',
    },
    laborFee: 0,
    partsFee: 0,
    totalFee: 0,
    isDateTimePickerOpen: false,
    pickerTarget: '',
    tempDate: '',
    tempClock: '',
  },

  onLoad(query) {
    const { headerHeight } = getNavBarInfo()
    const id = query.id
    const raw = store.getById(id)
    if (!raw) {
      wx.showToast({ title: '工单不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    const form = {
      confirmNo: raw.confirmNo || '',
      repairVendor: raw.repairVendor || '',
      repairer: raw.repairer || '',
      follower: raw.follower || '',
      startDate: parseStored(raw.startTime).date,
      startClock: parseStored(raw.startTime).clock,
      endDate: parseStored(raw.endTime).date,
      endClock: parseStored(raw.endTime).clock,
      duration: raw.duration || '',
      hourlyRate: (() => {
        const h = parseFloat(raw.duration) || 0
        return h > 0 && raw.laborFee ? String(Math.round(raw.laborFee / h)) : ''
      })(),
      partsChanged: !!raw.partsChanged,
      parts: (raw.parts || []).map(p => ({ ...p })),
      photosBefore: raw.photosBefore || [],
      photosAfter: raw.photosAfter || [],
      photosConfirm: raw.photosConfirm || [],
      discount: raw.discount || '',
      chargeRemark: raw.chargeRemark || '',
    }
    this.setData({
      headerHeight: Math.ceil(headerHeight),
      id,
      form,
    }, () => this.recomputeTotals())
  },

  recomputeTotals() {
    const { form } = this.data
    const partsFee = form.partsChanged ? sumParts(form.parts) : 0
    const hours = parseFloat(form.duration) || 0
    const rate = Number(form.hourlyRate) || 0
    const labor = Math.round(rate * hours)
    const disc = Number(form.discount) || 0
    this.setData({
      partsFee,
      laborFee: labor,
      totalFee: labor + partsFee - disc,
    })
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [`form.${field}`]: e.detail.value }, () => {
      if (['hourlyRate', 'discount'].includes(field)) this.recomputeTotals()
    })
  },

  openDateTimePicker(e) {
    const target = e.currentTarget.dataset.target
    const f = this.data.form
    this.setData({
      isDateTimePickerOpen: true,
      pickerTarget: target,
      tempDate: target === 'start' ? f.startDate : f.endDate,
      tempClock: target === 'start' ? f.startClock : f.endClock,
    })
  },
  onTempDateChange(e) { this.setData({ tempDate: e.detail.value }) },
  onTempClockChange(e) { this.setData({ tempClock: e.detail.value }) },
  cancelDateTimePicker() { this.setData({ isDateTimePickerOpen: false }) },
  closeDateTimePicker() { this.setData({ isDateTimePickerOpen: false }) },
  stopPropagation() {},
  confirmDateTimePicker() {
    const { tempDate, tempClock, pickerTarget } = this.data
    if (!tempDate || !tempClock) {
      wx.showToast({ title: '请选择日期和时间', icon: 'none' })
      return
    }
    const prefix = pickerTarget === 'start' ? 'start' : 'end'
    this.setData({
      [`form.${prefix}Date`]: tempDate,
      [`form.${prefix}Clock`]: tempClock,
      isDateTimePickerOpen: false,
    }, () => this.syncDuration())
  },

  onPartsChange(e) {
    const partsChanged = e.detail
    const newData = { 'form.partsChanged': partsChanged }
    if (!partsChanged) newData['form.parts'] = []
    else if (!this.data.form.parts.length) {
      newData['form.parts'] = [{ name: '', qty: 1, price: 0, image: '' }]
    }
    this.setData(newData, () => this.recomputeTotals())
  },

  syncDuration() {
    const f = this.data.form
    const d = computeDuration(f.startDate, f.startClock, f.endDate, f.endClock)
    this.setData({ 'form.duration': d }, () => this.recomputeTotals())
  },

  onAddPart() {
    const parts = [...this.data.form.parts, { name: '', qty: 1, price: 0, image: '' }]
    this.setData({ 'form.parts': parts })
  },

  onRemovePart(e) {
    const i = Number(e.currentTarget.dataset.index)
    const parts = this.data.form.parts.filter((_, idx) => idx !== i)
    this.setData({ 'form.parts': parts }, () => this.recomputeTotals())
  },

  onPartInput(e) {
    const { index, field } = e.currentTarget.dataset
    const parts = [...this.data.form.parts]
    parts[index] = { ...parts[index], [field]: e.detail.value }
    this.setData({ 'form.parts': parts }, () => this.recomputeTotals())
  },

  onUploadPartImage(e) {
    const i = Number(e.currentTarget.dataset.index)
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['original'],
      success: async res => {
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          const [path] = await compressLocalImages([res.tempFiles[0].tempFilePath])
          const parts = [...this.data.form.parts]
          parts[i] = { ...parts[i], image: path }
          this.setData({ 'form.parts': parts })
        } finally {
          wx.hideLoading()
        }
      },
    })
  },

  onUploadPhoto(e) {
    const { group } = e.currentTarget.dataset
    const max = 3
    const curr = this.data.form[group] || []
    if (curr.length >= max) {
      wx.showToast({ title: `最多 ${max} 张`, icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: max - curr.length,
      mediaType: ['image'],
      sizeType: ['original'],
      success: async res => {
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          const newPaths = await compressLocalImages(res.tempFiles.map(f => f.tempFilePath))
          this.setData({ [`form.${group}`]: [...curr, ...newPaths] })
        } finally {
          wx.hideLoading()
        }
      },
    })
  },

  onRemovePhoto(e) {
    const { group, index } = e.currentTarget.dataset
    const arr = this.data.form[group].filter((_, i) => i !== Number(index))
    this.setData({ [`form.${group}`]: arr })
  },

  onSave() {
    const { form } = this.data
    if (!form.repairVendor) { wx.showToast({ title: '请填写维修方', icon: 'none' }); return }
    if (!form.repairer) { wx.showToast({ title: '请填写维修员', icon: 'none' }); return }
    if (!form.hourlyRate && form.hourlyRate !== 0) { wx.showToast({ title: '请填写单价', icon: 'none' }); return }

    const parts = form.partsChanged ? form.parts.filter(p => p.name).map(p => ({
      name: p.name,
      qty: Number(p.qty) || 0,
      price: Number(p.price) || 0,
      image: p.image || '',
    })) : []
    const partsFee = sumParts(parts)
    const hours = parseFloat(form.duration) || 0
    const laborFee = Math.round((Number(form.hourlyRate) || 0) * hours)
    const discount = Number(form.discount) || 0

    store.update(this.data.id, {
      status: 'Completed',
      confirmNo: form.confirmNo,
      repairVendor: form.repairVendor,
      repairer: form.repairer,
      follower: form.follower,
      startTime: form.startDate && form.startClock ? `${form.startDate} ${form.startClock}` : '',
      endTime: form.endDate && form.endClock ? `${form.endDate} ${form.endClock}` : '',
      duration: form.duration,
      laborFee,
      partsChanged: form.partsChanged,
      parts,
      partsFee,
      discount,
      totalAmount: laborFee + partsFee - discount,
      photosBefore: form.photosBefore,
      photosAfter: form.photosAfter,
      photosConfirm: form.photosConfirm,
      chargeRemark: form.chargeRemark,
      payStatus: '待付',
    })

    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 600)
  },

  onCancel() {
    wx.navigateBack()
  },
})
